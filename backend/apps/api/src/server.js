const express = require('express');
const crypto = require('crypto');
const { readStore, writeStore } = require('./store');

const app = express();
app.use(express.json({ limit: '2mb' }));

const requestBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 240;

app.use((req, res, next) => {
  const key = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { ts: now, count: 0 };
  if (now - bucket.ts > RATE_WINDOW_MS) {
    bucket.ts = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  if (bucket.count > RATE_LIMIT) {
    return res.status(429).json({ code: 'RATE_LIMIT', message: 'Too many requests' });
  }
  return next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend-api', now: new Date().toISOString() });
});

app.get('/health/worker', (req, res) => {
  const store = readStore();
  const lastPing = Number(store.worker?.last_ping_at || 0);
  const staleMs = 90 * 1000;
  const online = lastPing > 0 && (Date.now() - lastPing) < staleMs;
  res.json({
    ok: online,
    service: 'worker',
    status: online ? 'healthy' : 'stale',
    last_ping_at: lastPing || null
  });
});

app.post('/health/worker/ping', (req, res) => {
  const store = readStore();
  store.worker = {
    last_ping_at: Date.now(),
    status: 'healthy'
  };
  writeStore(store);
  res.json({ ok: true });
});

app.get('/health/storage', (req, res) => {
  try {
    const snapshot = readStore();
    writeStore(snapshot);
    res.json({ ok: true, service: 'storage', writable: true });
  } catch (error) {
    res.status(500).json({ ok: false, service: 'storage', writable: false, error: String(error?.message || error) });
  }
});

app.get('/health/ai', (req, res) => {
  res.json({
    ok: true,
    service: 'ai',
    mode: 'heuristics+learning',
    features: ['file_analysis', 'intent_detection', 'recommendation', 'decision', 'automation']
  });
});

app.get('/metrics/ops', (req, res) => {
  const store = readStore();
  const events = Array.isArray(store.job_events) ? store.job_events : [];
  const history = Array.isArray(store.history) ? store.history : [];
  const completed = events.filter((item) => item.stage === 'cleanup' || item.stage === 'completed').length;
  const failed = events.filter((item) => item.stage === 'failed' || item.stage === 'error').length;
  const activeQueue = Math.max(0, history.length - completed - failed);
  const successRate = completed + failed === 0
    ? 1
    : completed / (completed + failed);

  res.json({
    ok: true,
    job_success_rate: Number(successRate.toFixed(4)),
    error_rate: Number((1 - successRate).toFixed(4)),
    queue_depth: activeQueue,
    processing_latency_hint_ms: 19000,
    total_job_events: events.length
  });
});

const createToken = () => crypto.randomBytes(9).toString('hex');
const createId = () => crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

const SHARE_EXPIRY_PRESETS = {
  one_hour: 60 * 60,
  one_day: 24 * 60 * 60,
  seven_days: 7 * 24 * 60 * 60,
  thirty_days: 30 * 24 * 60 * 60,
  never: 0
};

const featureFlagDefaults = {
  smart_auto_convert: true,
  public_share_links: true,
  instant_preview: true,
  transparency_panel: true,
  one_click_best_convert: true,
  conversion_history_workspace: true
};

const resolveFeatureFlags = (store) => ({
  ...featureFlagDefaults,
  ...((store.platform_settings && store.platform_settings.feature_flags) || {})
});

const getAdminActor = (req) => ({
  admin_id: String(req.headers['x-admin-id'] || req.headers['x-user-id'] || 'system'),
  admin_email: String(req.headers['x-admin-email'] || req.headers['x-user-email'] || 'system@local')
});

const appendAuditLog = (store, req, action, details = {}) => {
  const actor = getAdminActor(req);
  const entry = {
    id: createId(),
    action: String(action || 'unknown'),
    actor,
    details,
    method: req.method,
    path: req.path,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
    created_at: Date.now()
  };
  if (!Array.isArray(store.audit_logs)) store.audit_logs = [];
  store.audit_logs.push(entry);
  if (store.audit_logs.length > 5000) {
    store.audit_logs = store.audit_logs.slice(-5000);
  }
  return entry;
};

app.post('/share', (req, res) => {
  const { file_url, file_id, expires_in, expires_preset } = req.body || {};
  if (!file_url) return res.status(400).json({ code: 'INVALID', message: 'file_url is required' });
  const preset = typeof expires_preset === 'string' ? expires_preset.trim().toLowerCase() : '';
  const presetSeconds = Object.prototype.hasOwnProperty.call(SHARE_EXPIRY_PRESETS, preset)
    ? SHARE_EXPIRY_PRESETS[preset]
    : null;
  const explicitSeconds = Number(expires_in);
  const ttlSeconds = Number.isFinite(explicitSeconds) && explicitSeconds >= 0
    ? explicitSeconds
    : (presetSeconds !== null ? presetSeconds : SHARE_EXPIRY_PRESETS.seven_days);
  const token = createToken();
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  const store = readStore();
  store.shares[token] = {
    id: token,
    file_id: file_id || null,
    url: file_url,
    expires_preset: preset || (ttlSeconds === 0 ? 'never' : 'custom'),
    expires_in: ttlSeconds,
    expires_at: expiresAt,
    created_at: Date.now()
  };
  writeStore(store);
  res.json({ token, url: file_url, expires_in: ttlSeconds, expires_at: expiresAt });
});

app.get('/share-expiry-presets', (_req, res) => {
  res.json({ ok: true, presets: SHARE_EXPIRY_PRESETS, default: 'seven_days' });
});

app.get('/share/expiry-presets', (_req, res) => {
  res.json({ ok: true, presets: SHARE_EXPIRY_PRESETS, default: 'seven_days' });
});

app.get('/share/:token', (req, res) => {
  const store = readStore();
  const item = store.shares[req.params.token];
  if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: 'Share not found' });
  if (item.expires_at && Date.now() > item.expires_at) {
    delete store.shares[req.params.token];
    writeStore(store);
    return res.status(410).json({ code: 'EXPIRED', message: 'Share expired' });
  }
  res.json(item);
});

app.post('/flags/evaluate', (req, res) => {
  const store = readStore();
  const payload = req.body || {};
  const requestedFlags = Array.isArray(payload.flags) ? payload.flags.filter(Boolean) : [];
  const allFlags = resolveFeatureFlags(store);
  if (!requestedFlags.length) {
    return res.json({ ok: true, flags: allFlags });
  }
  const subset = requestedFlags.reduce((acc, key) => {
    acc[key] = Boolean(allFlags[key]);
    return acc;
  }, {});
  return res.json({ ok: true, flags: subset });
});

app.get('/admin/settings/platform', (req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    item: {
      feature_flags: resolveFeatureFlags(store)
    }
  });
});

app.put('/admin/settings/platform', (req, res) => {
  const payload = req.body || {};
  const incomingFlags = payload.feature_flags && typeof payload.feature_flags === 'object'
    ? payload.feature_flags
    : {};
  const store = readStore();
  const nextFlags = {
    ...resolveFeatureFlags(store),
    ...incomingFlags
  };
  store.platform_settings = {
    ...(store.platform_settings || {}),
    feature_flags: nextFlags,
    updated_at: Date.now()
  };
  appendAuditLog(store, req, 'admin.platform_settings.update', { feature_flags: nextFlags });
  writeStore(store);
  res.json({ ok: true, item: store.platform_settings });
});

app.get('/admin/audit-logs', (req, res) => {
  const store = readStore();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const items = (store.audit_logs || []).slice(-limit).reverse();
  res.json({ ok: true, items });
});

app.get('/developers', (req, res) => {
  const store = readStore();
  const items = (store.developers || [])
    .filter((item) => item.is_active !== false)
    .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
  res.json({ ok: true, items });
});

app.post('/history', (req, res) => {
  const { user_id, job_id } = req.body || {};
  if (!user_id || !job_id) return res.status(400).json({ code: 'INVALID', message: 'user_id and job_id required' });
  const store = readStore();
  store.history.push({ user_id, job_id, created_at: Date.now() });
  writeStore(store);
  res.json({ ok: true });
});

app.get('/history/:user_id', (req, res) => {
  const userId = String(req.params.user_id || '').trim();
  if (!userId) return res.status(400).json({ code: 'INVALID', message: 'user_id required' });
  const store = readStore();
  const rows = store.history.filter((item) => item.user_id === userId);
  res.json({ ok: true, items: rows.slice(-100).reverse() });
});

app.post('/job-events', (req, res) => {
  const { job_id, stage, progress } = req.body || {};
  if (!job_id || !stage) return res.status(400).json({ code: 'INVALID', message: 'job_id and stage required' });
  const store = readStore();
  store.job_events.push({ job_id, stage, progress: Number(progress || 0), created_at: Date.now() });
  writeStore(store);
  res.json({ ok: true });
});

app.get('/job-events/:job_id', (req, res) => {
  const jobId = String(req.params.job_id || '').trim();
  if (!jobId) return res.status(400).json({ code: 'INVALID', message: 'job_id required' });
  const store = readStore();
  const items = store.job_events.filter((item) => item.job_id === jobId).slice(-300);
  res.json({ ok: true, items });
});

// --- Presets / workflows ---
app.get('/presets', (req, res) => {
  const userId = String(req.headers['x-user-id'] || '').trim();
  const store = readStore();
  const items = (store.presets || []).filter((item) => !userId || item.user_id === userId);
  res.json({ ok: true, items });
});

app.post('/presets', (req, res) => {
  const userId = String(req.headers['x-user-id'] || req.body?.user_id || '').trim() || 'anonymous';
  const payload = req.body || {};
  if (!payload.name) return res.status(400).json({ code: 'INVALID', message: 'name required' });
  const store = readStore();
  const item = {
    id: createId(),
    user_id: userId,
    name: String(payload.name),
    settings_json: payload.settings_json || {},
    created_at: Date.now()
  };
  store.presets.push(item);
  writeStore(store);
  res.json({ ok: true, item });
});

app.get('/workflows', (req, res) => {
  const userId = String(req.headers['x-user-id'] || '').trim();
  const store = readStore();
  const items = (store.workflows || []).filter((item) => !userId || item.user_id === userId);
  res.json({ ok: true, items });
});

app.post('/workflows', (req, res) => {
  const userId = String(req.headers['x-user-id'] || req.body?.user_id || '').trim() || 'anonymous';
  const payload = req.body || {};
  if (!payload.name) return res.status(400).json({ code: 'INVALID', message: 'name required' });
  const store = readStore();
  const item = {
    id: createId(),
    user_id: userId,
    name: String(payload.name),
    steps_json: payload.steps_json || [],
    created_at: Date.now()
  };
  store.workflows.push(item);
  writeStore(store);
  res.json({ ok: true, item });
});

app.post('/workflows/:id/run', (req, res) => {
  const store = readStore();
  const item = (store.workflows || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: 'workflow not found' });
  res.json({ ok: true, run_id: createId(), workflow_id: item.id, status: 'started' });
});

// --- API keys ---
app.get('/apikeys', (req, res) => {
  const userId = String(req.headers['x-user-id'] || '').trim();
  const store = readStore();
  const items = (store.api_keys || []).filter((item) => !userId || item.user_id === userId);
  res.json({ ok: true, items });
});

app.post('/apikeys', (req, res) => {
  const userId = String(req.headers['x-user-id'] || req.body?.user_id || '').trim() || 'anonymous';
  const payload = req.body || {};
  const rawKey = `mc_${crypto.randomBytes(18).toString('hex')}`;
  const item = {
    id: createId(),
    user_id: userId,
    key_hash: crypto.createHash('sha256').update(rawKey).digest('hex'),
    key_preview: `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`,
    name: String(payload.name || 'Default'),
    rate_limit: Number(payload.rate_limit || 120),
    revoked: false,
    created_at: Date.now()
  };
  const store = readStore();
  store.api_keys.push(item);
  writeStore(store);
  res.json({ ok: true, item: { ...item, key: rawKey } });
});

app.delete('/apikeys/:id', (req, res) => {
  const store = readStore();
  const item = (store.api_keys || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: 'api key not found' });
  item.revoked = true;
  item.revoked_at = Date.now();
  writeStore(store);
  res.json({ ok: true });
});

// --- Admin developers ---
app.get('/admin/developers', (req, res) => {
  const store = readStore();
  res.json({ ok: true, items: store.developers || [] });
});

app.post('/admin/developers', (req, res) => {
  const payload = req.body || {};
  if (!payload.name) return res.status(400).json({ code: 'INVALID', message: 'name required' });
  const store = readStore();
  const item = {
    id: createId(),
    name: String(payload.name || ''),
    role: String(payload.role || ''),
    bio: String(payload.bio || ''),
    avatar_url: String(payload.avatar_url || ''),
    github_url: String(payload.github_url || ''),
    linkedin_url: String(payload.linkedin_url || ''),
    twitter_url: String(payload.twitter_url || ''),
    website_url: String(payload.website_url || ''),
    order_index: Number(payload.order_index || 0),
    is_active: payload.is_active !== false,
    created_at: Date.now()
  };
  store.developers.push(item);
  appendAuditLog(store, req, 'admin.developers.create', { developer_id: item.id, name: item.name });
  writeStore(store);
  res.json({ ok: true, item });
});

app.put('/admin/developers/:id', (req, res) => {
  const store = readStore();
  const item = (store.developers || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: 'developer not found' });
  Object.assign(item, req.body || {}, { updated_at: Date.now() });
  appendAuditLog(store, req, 'admin.developers.update', { developer_id: item.id });
  writeStore(store);
  res.json({ ok: true, item });
});

app.delete('/admin/developers/:id', (req, res) => {
  const store = readStore();
  const existing = (store.developers || []).find((entry) => entry.id === req.params.id);
  store.developers = (store.developers || []).filter((entry) => entry.id !== req.params.id);
  appendAuditLog(store, req, 'admin.developers.delete', { developer_id: req.params.id, existed: Boolean(existing) });
  writeStore(store);
  res.json({ ok: true });
});

app.patch('/admin/developers/:id/toggle', (req, res) => {
  const store = readStore();
  const item = (store.developers || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: 'developer not found' });
  item.is_active = !item.is_active;
  item.updated_at = Date.now();
  appendAuditLog(store, req, 'admin.developers.toggle', { developer_id: item.id, is_active: item.is_active });
  writeStore(store);
  res.json({ ok: true, item });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log('[api] listening on :' + port);
});
