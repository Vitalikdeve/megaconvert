const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { TOOL_EXT, TOOL_IDS, TOOL_META } = require('../shared/tools');

const envCandidates = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env')
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const storageMode = (process.env.STORAGE_MODE || 's3').toLowerCase();
const required = ['REDIS_URL'];
if (storageMode === 's3') {
  required.push('S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET');
}
for (const key of required) {
  if (!process.env[key]) {
    console.error(JSON.stringify({ type: 'config_missing', key }));
  }
}

const log = (payload) => console.log(JSON.stringify(payload));
const logError = (payload) => console.error(JSON.stringify(payload));

const app = express();
app.set('etag', false);
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    log({
      type: 'http',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      origin: req.headers.origin || null,
      host: req.headers.host || null
    });
  });
  next();
});

const allowedOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowVercelPreviewOrigins = String(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS || 'true').toLowerCase() === 'true';
const allowAllHttpsOrigins = String(process.env.ALLOW_ALL_HTTPS_ORIGINS || 'true').toLowerCase() === 'true';

const isVercelPreviewOrigin = (origin) => {
  if (!origin || !allowVercelPreviewOrigins) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isVercelPreviewOrigin(origin)) return true;
  if (allowAllHttpsOrigins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === 'https:') return true;
    } catch {
      return false;
    }
  }
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Ensure middleware-level failures (invalid JSON/CORS) are returned as JSON.
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Invalid JSON payload',
      requestId: req.requestId
    });
  }
  if (String(err.message || '') === 'Not allowed by CORS') {
    return res.status(403).json({
      status: 'error',
      code: 'CORS_BLOCKED',
      message: 'Origin is not allowed',
      requestId: req.requestId
    });
  }
  return next(err);
});

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('convert', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 1000
  }
});

const s3 = storageMode === 's3' ? new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
  },
  forcePathStyle: true
}) : null;

const localRoot = process.env.LOCAL_STORAGE_DIR || '/data';
const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const RATE_LIMIT_UPLOADS_PER_MIN = Number(process.env.RATE_LIMIT_UPLOADS_PER_MIN || 30);
const RATE_LIMIT_JOBS_PER_MIN = Number(process.env.RATE_LIMIT_JOBS_PER_MIN || 20);
const ZK_SESSION_TTL_SEC = Number(process.env.ZK_SESSION_TTL_SEC || 180);
const REDIS_OP_TIMEOUT_MS = Number(process.env.REDIS_OP_TIMEOUT_MS || 2000);
const QUEUE_ADD_TIMEOUT_MS = Number(process.env.QUEUE_ADD_TIMEOUT_MS || 2000);
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_JWT_SECRET = String(process.env.ADMIN_JWT_SECRET || '').trim();
const ADMIN_SESSION_TTL_SEC = Math.max(300, Number(process.env.ADMIN_SESSION_TTL_SEC || 7 * 24 * 60 * 60));
const ADMIN_COOKIE_NAME = String(process.env.ADMIN_COOKIE_NAME || 'admin_token').trim() || 'admin_token';
const ADMIN_COOKIE_SECURE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ADMIN_COOKIE_SECURE || (process.env.NODE_ENV === 'production' ? '1' : '0')).trim().toLowerCase()
);
const ADMIN_AUTH_ENABLED = Boolean(ADMIN_PASSWORD && ADMIN_JWT_SECRET);
const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);
const parseEnvBoolean = (rawValue, defaultValue = false) => {
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (!normalized) return Boolean(defaultValue);
  if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
  if (BOOLEAN_FALSE_VALUES.has(normalized)) return false;
  return Boolean(defaultValue);
};
const readFirstEnvValue = (envKeys) => {
  for (const envKey of envKeys) {
    const value = String(process.env[envKey] ?? '').trim();
    if (value) return { key: envKey, value };
  }
  return { key: null, value: '' };
};
const CLICKHOUSE_URL = String(process.env.CLICKHOUSE_URL || '').trim();
const ANALYTICS_ENABLED = parseEnvBoolean(process.env.ANALYTICS_ENABLED, Boolean(CLICKHOUSE_URL));
const CLICKHOUSE_DATABASE = String(process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || 'megaconvert_analytics').trim();
const CLICKHOUSE_TABLE = String(process.env.CLICKHOUSE_TABLE || 'analytics_events_raw').trim();
const CLICKHOUSE_USER = String(process.env.CLICKHOUSE_USER || '').trim();
const CLICKHOUSE_PASSWORD = String(process.env.CLICKHOUSE_PASSWORD || '').trim();
const ANALYTICS_BATCH_SIZE = Math.max(1, Number(process.env.ANALYTICS_BATCH_SIZE || 200));
const ANALYTICS_FLUSH_INTERVAL_MS = Math.max(200, Number(process.env.ANALYTICS_FLUSH_INTERVAL_MS || 2000));
const ANALYTICS_INSERT_TIMEOUT_MS = Math.max(200, Number(process.env.ANALYTICS_INSERT_TIMEOUT_MS || 2500));
const ANALYTICS_QUERY_TIMEOUT_MS = Math.max(200, Number(process.env.ANALYTICS_QUERY_TIMEOUT_MS || 3000));
const ANALYTICS_MAX_BUFFER = Math.max(ANALYTICS_BATCH_SIZE, Number(process.env.ANALYTICS_MAX_BUFFER || 10000));
const ANALYTICS_USE_FALLBACK = parseEnvBoolean(process.env.ANALYTICS_USE_FALLBACK, true);
const ANALYTICS_FALLBACK_FILE = String(
  process.env.ANALYTICS_FALLBACK_FILE || path.join(__dirname, '..', 'data', 'analytics_events_fallback.jsonl')
).trim();
const ANALYTICS_FALLBACK_MAX_ROWS = Math.max(1000, Number(process.env.ANALYTICS_FALLBACK_MAX_ROWS || 50000));
const ANALYTICS_FALLBACK_MAX_LATENCY_POINTS = Math.max(100, Number(process.env.ANALYTICS_FALLBACK_MAX_LATENCY_POINTS || 10000));
const ANALYTICS_FALLBACK_INGEST_ENABLED = parseEnvBoolean(process.env.ANALYTICS_FALLBACK_INGEST_ENABLED, true);
const DATABASE_ENV_CANDIDATES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'PG_CONNECTION_STRING'
];
const { key: DATABASE_URL_SOURCE, value: DATABASE_URL } = readFirstEnvValue(DATABASE_ENV_CANDIDATES);
const PROMO_CODES_ENABLED = parseEnvBoolean(process.env.PROMO_CODES_ENABLED, true);
const PROMO_QUERY_TIMEOUT_MS = Math.max(500, Number(process.env.PROMO_QUERY_TIMEOUT_MS || 5000));
const PROMO_DB_POOL_MAX = Math.max(1, Number(process.env.PROMO_DB_POOL_MAX || 10));
const PROMO_DB_IDLE_TIMEOUT_MS = Math.max(1000, Number(process.env.PROMO_DB_IDLE_TIMEOUT_MS || 30000));
const PROMO_DB_CONNECT_TIMEOUT_MS = Math.max(1000, Number(process.env.PROMO_DB_CONNECT_TIMEOUT_MS || 5000));
const PROMO_CODE_MAX_LEN = Math.max(8, Number(process.env.PROMO_CODE_MAX_LEN || 64));
const PROMO_IDEMPOTENCY_KEY_MAX_LEN = Math.max(16, Number(process.env.PROMO_IDEMPOTENCY_KEY_MAX_LEN || 128));
const PROMO_TRIAL_MAX_DAYS = Math.max(1, Number(process.env.PROMO_TRIAL_MAX_DAYS || 365));
const SEARCH_RANGE_WINDOWS = {
  '24h': 'now() - INTERVAL 24 HOUR',
  '7d': 'now() - INTERVAL 7 DAY',
  '30d': 'now() - INTERVAL 30 DAY'
};
const SEARCH_RANGE_DURATIONS_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};
const ADMIN_POSTS_FILE = String(
  process.env.ADMIN_POSTS_FILE || path.join(__dirname, '..', 'data', 'admin_posts.json')
).trim();
const POST_LIKES_FILE = String(
  process.env.POST_LIKES_FILE || path.join(__dirname, '..', 'data', 'post_likes.json')
).trim();
const ADMIN_POST_STATUSES = new Set(['draft', 'published', 'archived']);
const ADMIN_POST_TITLE_MAX_LEN = Math.max(32, Number(process.env.ADMIN_POST_TITLE_MAX_LEN || 160));
const ADMIN_POST_EXCERPT_MAX_LEN = Math.max(64, Number(process.env.ADMIN_POST_EXCERPT_MAX_LEN || 280));
const ADMIN_POST_CONTENT_MAX_LEN = Math.max(256, Number(process.env.ADMIN_POST_CONTENT_MAX_LEN || 200000));
const POST_LIKE_RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.POST_LIKE_RATE_LIMIT_PER_MIN || 10));
const PROMO_CODE_ALLOWED = /^[A-Z0-9][A-Z0-9_-]*$/;
const PROMO_BENEFIT_TYPES = new Set(['percent_discount', 'trial_days', 'lifetime_access', 'credits', 'feature_access']);
const PROMO_ADMIN_LIST_LIMIT = Math.max(10, Number(process.env.PROMO_ADMIN_LIST_LIMIT || 500));
const ACCOUNT_CONNECTION_PROVIDERS = new Set(['google', 'github']);
const ACCOUNT_CONNECTION_EMAIL_MAX_LEN = Math.max(64, Number(process.env.ACCOUNT_CONNECTION_EMAIL_MAX_LEN || 160));
const ACCOUNT_PROVIDER_USER_ID_MAX_LEN = Math.max(16, Number(process.env.ACCOUNT_PROVIDER_USER_ID_MAX_LEN || 256));
const ACCOUNT_SESSIONS_LIST_LIMIT = Math.max(5, Number(process.env.ACCOUNT_SESSIONS_LIST_LIMIT || 20));
const ACCOUNT_SESSION_ID_MAX_LEN = Math.max(16, Number(process.env.ACCOUNT_SESSION_ID_MAX_LEN || 128));
const ACCOUNT_SESSION_TTL_SEC = Math.max(60 * 60, Number(process.env.ACCOUNT_SESSION_TTL_SEC || 30 * 24 * 60 * 60));
const ACCOUNT_PROFILE_NAME_MAX_LEN = Math.max(8, Number(process.env.ACCOUNT_PROFILE_NAME_MAX_LEN || 80));
const ACCOUNT_PROFILE_TZ_MAX_LEN = Math.max(8, Number(process.env.ACCOUNT_PROFILE_TZ_MAX_LEN || 64));
const ACCOUNT_PROFILE_AVATAR_MAX_LEN = Math.max(64, Number(process.env.ACCOUNT_PROFILE_AVATAR_MAX_LEN || 512));
const ACCOUNT_TELEGRAM_CODE_ALPHABET = (
  String(process.env.ACCOUNT_TELEGRAM_CODE_ALPHABET || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
);
const ACCOUNT_TELEGRAM_CODE_LENGTH = Math.min(
  32,
  Math.max(4, Number(process.env.ACCOUNT_TELEGRAM_CODE_LENGTH || 8))
);
const ACCOUNT_TELEGRAM_CODE_TTL_SEC = Math.max(60, Number(process.env.ACCOUNT_TELEGRAM_CODE_TTL_SEC || 600));
const ACCOUNT_TELEGRAM_INTERNAL_TIMEOUT_MS = Math.max(500, Number(process.env.ACCOUNT_TELEGRAM_INTERNAL_TIMEOUT_MS || 5000));
const BOT_INTERNAL_API_BASE = String(process.env.BOT_INTERNAL_API_BASE || '').trim().replace(/\/+$/, '');
const BOT_INTERNAL_LINK_SECRET = String(
  process.env.BOT_INTERNAL_LINK_SECRET || process.env.INTERNAL_LINK_SECRET || ''
).trim();

const twofaCodes = new Map(); // email -> { code, expiresAt }
const twofaTokens = new Map(); // token -> { email, expiresAt }
let redisReady = false;
let lastRedisError = null;
let bucketReady = false;
let analyticsFlushTimer = null;
let analyticsFlushInFlight = false;
const analyticsBuffer = [];
let analyticsFallbackWriteQueue = Promise.resolve();
let adminPostsStore = null;
let postLikesStore = null;
let postLikesMutationQueue = Promise.resolve();
let pgPool = null;
let pgModuleLoadAttempted = false;
let pgPoolInitError = null;

const withTimeout = (promise, timeoutMs, timeoutMessage) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  Promise.resolve(promise)
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

const redisUnavailablePayload = (requestId, details) => ({
  status: 'error',
  code: 'QUEUE_UNAVAILABLE',
  message: 'Queue is unavailable',
  details,
  requestId
});

const isQueueUnavailableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('queue_add_timeout')
    || message.includes('redis')
    || message.includes('econnrefused')
    || message.includes('connection is closed');
};

connection.on('ready', () => {
  redisReady = true;
  lastRedisError = null;
  log({ type: 'redis_ready' });
});

connection.on('error', (error) => {
  redisReady = false;
  lastRedisError = error?.message || 'unknown';
  logError({ type: 'redis_error', error: lastRedisError });
});

connection.on('end', () => {
  redisReady = false;
  logError({ type: 'redis_end' });
});

async function ensureRedisAvailable(requestId) {
  try {
    const pong = await withTimeout(connection.ping(), REDIS_OP_TIMEOUT_MS, 'redis_ping_timeout');
    if (pong !== 'PONG') {
      redisReady = false;
      lastRedisError = 'redis_ping_failed';
      return { ok: false, payload: redisUnavailablePayload(requestId, 'redis_ping_failed') };
    }
    redisReady = true;
    lastRedisError = null;
    return { ok: true };
  } catch (error) {
    redisReady = false;
    lastRedisError = error?.message || 'redis_ping_failed';
    return { ok: false, payload: redisUnavailablePayload(requestId, lastRedisError) };
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function pruneExpiredTwofa(now = Date.now()) {
  for (const [email, record] of twofaCodes.entries()) {
    if (!record || !record.expiresAt || record.expiresAt < now) {
      twofaCodes.delete(email);
    }
  }
  for (const [token, record] of twofaTokens.entries()) {
    if (!record || !record.expiresAt || record.expiresAt < now) {
      twofaTokens.delete(token);
    }
  }
}

async function sendTwofaEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'MegaConvert <no-reply@megaconvert.net>';

  if (!apiKey) {
    console.log(JSON.stringify({ type: 'twofa_dev', email, code }));
    return { ok: true, dev: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your MegaConvert verification code',
      text: `Your verification code is: ${code}`
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error: ${body}`);
  }
  return { ok: true };
}

function sanitizeFileName(name) {
  return name.replace(/[\\/]/g, '_').replace(/\s+/g, '_');
}

const bytesToB64 = (bytes) => Buffer.from(bytes).toString('base64');

async function rateLimit(key, limit, windowSec) {
  const count = await withTimeout(connection.incr(key), REDIS_OP_TIMEOUT_MS, 'redis_incr_timeout');
  if (count === 1) {
    await withTimeout(connection.expire(key, windowSec), REDIS_OP_TIMEOUT_MS, 'redis_expire_timeout');
  }
  return count <= limit;
}

function getClientId(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const userId = req.headers['x-user-id'];
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padLen)}`;
  return Buffer.from(padded, 'base64');
}

function signAdminJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerPart}.${payloadPart}`;
  const signature = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(unsigned).digest();
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

function verifyAdminJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const unsigned = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(unsigned).digest();
  const actual = base64UrlDecode(signaturePart);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  if (!raw) return {};
  const out = {};
  const chunks = raw.split(';');
  for (const chunk of chunks) {
    const idx = chunk.indexOf('=');
    if (idx < 0) continue;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function buildAdminCookie(token, maxAgeSec = ADMIN_SESSION_TTL_SEC) {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token || '')}`,
    'Path=/',
    `Max-Age=${Math.max(0, Number(maxAgeSec) || 0)}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (ADMIN_COOKIE_SECURE) parts.push('Secure');
  return parts.join('; ');
}

function buildAdminExpiredCookie() {
  return buildAdminCookie('', 0);
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_AUTH_ENABLED) {
    return res.status(503).json({
      status: 'error',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: 'Admin auth is not configured',
      requestId: req.requestId
    });
  }
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE_NAME];
  const payload = verifyAdminJwt(token);
  if (!payload || payload.sub !== 'admin') {
    return res.status(401).json({
      status: 'error',
      code: 'ADMIN_UNAUTHORIZED',
      message: 'Admin login required',
      requestId: req.requestId
    });
  }
  req.admin = payload;
  return next();
}

function getRequestUserId(req) {
  const raw = req.headers['x-user-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim();
}

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePromoUserId(rawUserId) {
  const normalized = String(rawUserId || '').trim();
  if (!normalized) return '';
  if (UUID_LIKE_PATTERN.test(normalized)) {
    return normalized.toLowerCase();
  }

  // Promo storage schema expects UUID user ids; derive a stable UUID from external ids (e.g. Firebase uid).
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  const section1 = hash.slice(0, 8);
  const section2 = hash.slice(8, 12);
  const section3 = `5${hash.slice(13, 16)}`;
  const variant = (parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8;
  const section4 = `${variant.toString(16)}${hash.slice(17, 20)}`;
  const section5 = hash.slice(20, 32);
  return `${section1}-${section2}-${section3}-${section4}-${section5}`;
}

function requireUserAuth(req, res, next) {
  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      code: 'USER_UNAUTHORIZED',
      message: 'User login required',
      requestId: req.requestId
    });
  }
  req.user = { id: userId };
  return next();
}

function normalizeAccountProvider(rawProvider) {
  const provider = String(rawProvider || '').trim().toLowerCase();
  return ACCOUNT_CONNECTION_PROVIDERS.has(provider) ? provider : '';
}

function normalizeAccountConnectionEmail(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return null;
  if (!value.includes('@')) return null;
  return value.slice(0, ACCOUNT_CONNECTION_EMAIL_MAX_LEN);
}

function normalizeAccountProviderUserId(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  return value.slice(0, ACCOUNT_PROVIDER_USER_ID_MAX_LEN);
}

function normalizeSessionId(req) {
  const rawHeader = req.headers['x-session-id'];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > ACCOUNT_SESSION_ID_MAX_LEN) return '';
  return normalized;
}

function hashSessionId(sessionId) {
  return crypto.createHash('sha256').update(String(sessionId || '')).digest('hex');
}

function getRequestIpAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const fallback = req.socket?.remoteAddress || '';
  const selected = forwarded || fallback;
  return toCleanText(selected, 128) || null;
}

function resolveSessionDeviceLabel(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('firefox/')
        ? 'Firefox'
        : ua.includes('safari/') && !ua.includes('chrome/')
          ? 'Safari'
          : 'Browser';
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('mac os')
      ? 'macOS'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')
          ? 'iOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Device';
  return `${browser} on ${os}`;
}

function getAccountStorageStatus() {
  if (!DATABASE_URL) {
    return {
      ok: false,
      statusCode: 503,
      code: 'ACCOUNT_STORAGE_NOT_CONFIGURED',
      message: 'Account storage is not configured'
    };
  }
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      code: 'ACCOUNT_STORAGE_UNAVAILABLE',
      message: 'Account storage is unavailable'
    };
  }
  return { ok: true, pool };
}

async function touchAccountSession({ pool, req, userId }) {
  const sessionId = normalizeSessionId(req);
  if (!sessionId) return null;
  const sessionHash = hashSessionId(sessionId);
  const userAgent = toCleanText(req.headers['user-agent'] || '', 512) || null;
  const ipAddress = getRequestIpAddress(req);
  const result = await pool.query(
    `
      INSERT INTO user_sessions (
        id,
        user_id,
        session_token_hash,
        user_agent,
        ip_address,
        created_at,
        last_active_at,
        expires_at,
        revoked_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        now(),
        now(),
        now() + ($5::int * interval '1 second'),
        NULL
      )
      ON CONFLICT (session_token_hash)
      DO UPDATE SET
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address,
        last_active_at = now(),
        expires_at = now() + ($5::int * interval '1 second'),
        revoked_at = NULL
      WHERE user_sessions.user_id = EXCLUDED.user_id
      RETURNING
        id,
        user_id,
        session_token_hash,
        user_agent,
        ip_address,
        created_at,
        last_active_at,
        expires_at,
        revoked_at
    `,
    [userId, sessionHash, userAgent, ipAddress, ACCOUNT_SESSION_TTL_SEC]
  );

  if (result.rowCount <= 0) {
    throw new PromoApiError(409, 'SESSION_OWNERSHIP_CONFLICT', 'Session belongs to another account');
  }
  return {
    ...result.rows[0],
    current_hash: sessionHash
  };
}

function mapAccountConnectionRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || '').trim(),
    provider: normalizeAccountProvider(row.provider),
    provider_user_id: String(row.provider_user_id || '').trim() || null,
    email: normalizeAccountConnectionEmail(row.email),
    linked_at: toIsoOrNull(row.linked_at)
  };
}

function mapAccountSessionRow(row, currentHash) {
  if (!row) return null;
  const sessionHash = String(row.session_token_hash || '').trim();
  return {
    id: String(row.id || '').trim(),
    device: resolveSessionDeviceLabel(row.user_agent),
    user_agent: toCleanText(row.user_agent || '', 512) || null,
    ip: toCleanText(row.ip_address || '', 128) || null,
    created_at: toIsoOrNull(row.created_at),
    last_active: toIsoOrNull(row.last_active_at),
    expires_at: toIsoOrNull(row.expires_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    current: Boolean(currentHash && sessionHash && sessionHash === currentHash)
  };
}

function mapAccountProfileRow(row, userId) {
  const value = row || {};
  return {
    user_id: String(userId || '').trim(),
    display_name: toCleanText(value.display_name || '', ACCOUNT_PROFILE_NAME_MAX_LEN) || null,
    timezone: toCleanText(value.timezone || '', ACCOUNT_PROFILE_TZ_MAX_LEN) || null,
    avatar_url: toCleanText(value.avatar_url || '', ACCOUNT_PROFILE_AVATAR_MAX_LEN) || null,
    updated_at: toIsoOrNull(value.updated_at)
  };
}

function normalizeAdminPostStatus(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (ADMIN_POST_STATUSES.has(normalized)) return normalized;
  return null;
}

function slugifyPostValue(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || '';
}

function clampText(value, maxLen) {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim();
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAdminPostExcerpt(contentMd, explicitExcerpt = '') {
  const prepared = String(explicitExcerpt || '').trim();
  if (prepared) return clampText(prepared, ADMIN_POST_EXCERPT_MAX_LEN);
  return clampText(stripMarkdown(contentMd), ADMIN_POST_EXCERPT_MAX_LEN);
}

function toIsoOrDefault(value, fallbackIso = null) {
  if (value === null || value === undefined || value === '') return fallbackIso;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return fallbackIso;
  return asDate.toISOString();
}

function getUniqueAdminPostSlug(posts, preferredSlug, excludeId = null) {
  const existing = new Set(
    posts
      .filter((post) => post && post.id !== excludeId)
      .map((post) => String(post.slug || '').trim())
      .filter(Boolean)
  );
  const base = slugifyPostValue(preferredSlug) || 'post';
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeStoredAdminPost(raw) {
  const value = asObject(raw);
  const nowIso = new Date().toISOString();
  const title = clampText(String(value.title || '').trim() || 'Untitled post', ADMIN_POST_TITLE_MAX_LEN);
  const contentMd = clampText(String(value.content_md || ''), ADMIN_POST_CONTENT_MAX_LEN);
  const likesCountRaw = Number(value.likes_count ?? value.likesCount ?? 0);
  const likesCount = Number.isFinite(likesCountRaw) && likesCountRaw >= 0 ? Math.floor(likesCountRaw) : 0;
  const status = normalizeAdminPostStatus(value.status, 'draft') || 'draft';
  const createdAt = toIsoOrDefault(value.created_at, nowIso) || nowIso;
  const updatedAt = toIsoOrDefault(value.updated_at, createdAt) || createdAt;
  const publishedAt = status === 'published'
    ? (toIsoOrDefault(value.published_at, updatedAt) || updatedAt)
    : null;

  return {
    id: String(value.id || uuidv4()).trim() || uuidv4(),
    slug: slugifyPostValue(value.slug || title) || 'post',
    title,
    excerpt: buildAdminPostExcerpt(contentMd, value.excerpt || ''),
    content_md: contentMd,
    status,
    likes_count: likesCount,
    created_at: createdAt,
    updated_at: updatedAt,
    published_at: publishedAt
  };
}

function loadAdminPostsStore() {
  if (Array.isArray(adminPostsStore)) return adminPostsStore;

  try {
    if (!fs.existsSync(ADMIN_POSTS_FILE)) {
      adminPostsStore = [];
      return adminPostsStore;
    }
    const raw = fs.readFileSync(ADMIN_POSTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      adminPostsStore = [];
      return adminPostsStore;
    }
    const normalized = parsed.map((item) => normalizeStoredAdminPost(item));
    const deduped = [];
    for (const post of normalized) {
      deduped.push({
        ...post,
        slug: getUniqueAdminPostSlug(deduped, post.slug)
      });
    }
    adminPostsStore = deduped;
    return adminPostsStore;
  } catch (error) {
    logError({
      type: 'admin_posts_load_failed',
      file: ADMIN_POSTS_FILE,
      error: error?.message || 'unknown'
    });
    adminPostsStore = [];
    return adminPostsStore;
  }
}

function saveAdminPostsStore(posts) {
  const next = Array.isArray(posts) ? posts : [];
  const dir = path.dirname(ADMIN_POSTS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${ADMIN_POSTS_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, ADMIN_POSTS_FILE);
  adminPostsStore = next;
}

function normalizeStoredPostLike(raw) {
  const value = asObject(raw);
  const postId = String(value.post_id || value.postId || '').trim();
  const userId = String(value.user_id || value.userId || '').trim();
  if (!postId || !userId) return null;
  const nowIso = new Date().toISOString();
  return {
    id: String(value.id || uuidv4()).trim() || uuidv4(),
    post_id: postId,
    user_id: userId,
    created_at: toIsoOrDefault(value.created_at || value.createdAt, nowIso) || nowIso
  };
}

function dedupePostLikes(items) {
  const deduped = [];
  const seen = new Set();
  for (const item of (Array.isArray(items) ? items : [])) {
    const like = normalizeStoredPostLike(item);
    if (!like) continue;
    const key = `${like.post_id}:${like.user_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(like);
  }
  return deduped;
}

function loadPostLikesStore() {
  if (Array.isArray(postLikesStore)) return postLikesStore;
  try {
    if (!fs.existsSync(POST_LIKES_FILE)) {
      postLikesStore = [];
      return postLikesStore;
    }
    const raw = fs.readFileSync(POST_LIKES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      postLikesStore = [];
      return postLikesStore;
    }
    const deduped = dedupePostLikes(parsed);
    postLikesStore = deduped;
    return postLikesStore;
  } catch (error) {
    logError({
      type: 'post_likes_load_failed',
      file: POST_LIKES_FILE,
      error: error?.message || 'unknown'
    });
    postLikesStore = [];
    return postLikesStore;
  }
}

function savePostLikesStore(likes) {
  const next = dedupePostLikes(likes);
  const dir = path.dirname(POST_LIKES_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${POST_LIKES_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, POST_LIKES_FILE);
  postLikesStore = next;
}

function buildPostLikesCountMap(likes) {
  const map = new Map();
  for (const like of likes) {
    const postId = String(like?.post_id || '').trim();
    if (!postId) continue;
    map.set(postId, (map.get(postId) || 0) + 1);
  }
  return map;
}

function listAdminPosts() {
  const likes = loadPostLikesStore();
  const likesCountMap = buildPostLikesCountMap(likes);
  const items = loadAdminPostsStore().map((post) => ({
    ...post,
    likes_count: Number(likesCountMap.get(post.id) || 0)
  }));
  items.sort((left, right) => {
    const rightTs = Date.parse(right.updated_at || right.created_at || '') || 0;
    const leftTs = Date.parse(left.updated_at || left.created_at || '') || 0;
    return rightTs - leftTs;
  });
  return items;
}

function buildPublicPostSummary(post, { likesCount = 0, liked = false } = {}) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    status: post.status,
    likes_count: Number(likesCount || 0),
    liked: Boolean(liked),
    created_at: post.created_at,
    updated_at: post.updated_at,
    published_at: post.published_at
  };
}

function withPostLikesLock(fn) {
  const run = postLikesMutationQueue.then(() => fn());
  postLikesMutationQueue = run.catch(() => undefined);
  return run;
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function toPositiveInt(rawValue, fallback) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return Number(fallback);
  return Math.round(value);
}

function generateAccountTelegramCode(length = ACCOUNT_TELEGRAM_CODE_LENGTH) {
  const size = Math.min(32, Math.max(4, toPositiveInt(length, ACCOUNT_TELEGRAM_CODE_LENGTH)));
  const bytes = crypto.randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += ACCOUNT_TELEGRAM_CODE_ALPHABET[bytes[i] % ACCOUNT_TELEGRAM_CODE_ALPHABET.length];
  }
  return out;
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}
class PromoApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'PromoApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getPromoStorageStatus() {
  if (!PROMO_CODES_ENABLED) {
    return {
      ok: false,
      statusCode: 503,
      code: 'PROMO_DISABLED',
      message: 'Promo codes are disabled'
    };
  }
  if (!DATABASE_URL) {
    return {
      ok: false,
      statusCode: 503,
      code: 'PROMO_STORAGE_NOT_CONFIGURED',
      message: 'Promo storage is not configured'
    };
  }
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      code: 'PROMO_STORAGE_UNAVAILABLE',
      message: 'Promo storage is unavailable'
    };
  }
  return { ok: true, pool };
}

function getPgPool() {
  if (!DATABASE_URL) return null;
  if (pgPool) return pgPool;
  if (pgModuleLoadAttempted && !pgPool) return null;

  pgModuleLoadAttempted = true;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: PROMO_DB_POOL_MAX,
      idleTimeoutMillis: PROMO_DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: PROMO_DB_CONNECT_TIMEOUT_MS,
      statement_timeout: PROMO_QUERY_TIMEOUT_MS,
      application_name: 'megaconvert-api'
    });
    pgPool.on('error', (error) => {
      logError({ type: 'promo_db_pool_error', error: error?.message || 'unknown' });
    });
    log({
      type: 'promo_db_enabled',
      databaseUrlSource: DATABASE_URL_SOURCE || 'unknown',
      poolMax: PROMO_DB_POOL_MAX,
      connectTimeoutMs: PROMO_DB_CONNECT_TIMEOUT_MS,
      queryTimeoutMs: PROMO_QUERY_TIMEOUT_MS
    });
    return pgPool;
  } catch (error) {
    pgPoolInitError = error;
    logError({
      type: 'promo_db_init_failed',
      error: error?.message || 'unknown'
    });
    return null;
  }
}

function normalizePromoCode(rawCode) {
  return String(rawCode || '').trim().toUpperCase();
}

function parseBooleanInput(value, fieldName) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const lower = String(value || '').trim().toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'on') return true;
  if (lower === 'false' || lower === 'no' || lower === 'off') return false;
  throw new PromoApiError(400, 'INVALID_PROMO_FIELD', `${fieldName} must be boolean`);
}

function parseOptionalPositiveInt(rawValue, fieldName, { allowNull = true } = {}) {
  if (rawValue === undefined) return undefined;
  if (rawValue === null || rawValue === '') {
    if (allowNull) return null;
    throw new PromoApiError(400, 'INVALID_PROMO_FIELD', `${fieldName} is required`);
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PromoApiError(400, 'INVALID_PROMO_FIELD', `${fieldName} must be a positive integer`);
  }
  return Math.floor(value);
}

function parseOptionalDateTime(rawValue, fieldName) {
  if (rawValue === undefined) return undefined;
  if (rawValue === null || rawValue === '') return null;
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new PromoApiError(400, 'INVALID_PROMO_WINDOW', `${fieldName} must be a valid datetime`);
  }
  return date.toISOString();
}

function assertPromoWindow({ startsAtIso, expiresAtIso }) {
  if (!startsAtIso || !expiresAtIso) return;
  const startsAt = new Date(startsAtIso);
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    throw new PromoApiError(400, 'INVALID_PROMO_WINDOW', 'Promo datetime values are invalid');
  }
  if (expiresAt.getTime() <= startsAt.getTime()) {
    throw new PromoApiError(400, 'INVALID_PROMO_WINDOW', 'expires_at must be greater than starts_at');
  }
}

function validatePromoCodeValue(code) {
  if (!code) {
    throw new PromoApiError(400, 'MISSING_CODE', 'Promo code is required');
  }
  if (code.length > PROMO_CODE_MAX_LEN) {
    throw new PromoApiError(400, 'INVALID_CODE', `Promo code exceeds ${PROMO_CODE_MAX_LEN} characters`);
  }
  if (!PROMO_CODE_ALLOWED.test(code)) {
    throw new PromoApiError(400, 'INVALID_CODE', 'Promo code supports only A-Z, 0-9, "_" and "-"');
  }
}

function mapPromoCodeRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || '').trim(),
    code: String(row.code || '').trim(),
    benefit_type: String(row.benefit_type || '').trim(),
    benefit: asObject(row.benefit),
    max_redemptions: row.max_redemptions === null || row.max_redemptions === undefined
      ? null
      : asCount(row.max_redemptions),
    per_user_limit: Math.max(1, asCount(row.per_user_limit || 1)),
    redeemed_count: asCount(row.redeemed_count || 0),
    starts_at: toIsoOrNull(row.starts_at),
    expires_at: toIsoOrNull(row.expires_at),
    is_active: Boolean(row.is_active),
    created_at: toIsoOrNull(row.created_at),
    updated_at: toIsoOrNull(row.updated_at)
  };
}

function normalizePromoCodeAdminInput(rawBody, { partial = false } = {}) {
  const body = asObject(rawBody);
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const out = {};

  if (!partial || has('code')) {
    const code = normalizePromoCode(body.code);
    validatePromoCodeValue(code);
    out.code = code;
  }

  if (!partial || has('benefit_type')) {
    const benefitType = String(body.benefit_type || '').trim();
    if (!PROMO_BENEFIT_TYPES.has(benefitType)) {
      throw new PromoApiError(
        400,
        'INVALID_BENEFIT_TYPE',
        `benefit_type must be one of: ${Array.from(PROMO_BENEFIT_TYPES).join(', ')}`
      );
    }
    out.benefit_type = benefitType;
  }

  if (!partial || has('benefit')) {
    if (body.benefit === undefined || body.benefit === null || Array.isArray(body.benefit) || typeof body.benefit !== 'object') {
      throw new PromoApiError(400, 'INVALID_BENEFIT', 'benefit must be a JSON object');
    }
    out.benefit = normalizePromoBenefitJson(body.benefit);
  }

  if (!partial || has('max_redemptions')) {
    const parsed = parseOptionalPositiveInt(body.max_redemptions, 'max_redemptions', { allowNull: true });
    out.max_redemptions = parsed === undefined ? null : parsed;
  }

  if (!partial || has('per_user_limit')) {
    const parsed = parseOptionalPositiveInt(body.per_user_limit, 'per_user_limit', { allowNull: false });
    const effective = parsed === undefined ? 1 : parsed;
    if (effective !== 1) {
      throw new PromoApiError(400, 'UNSUPPORTED_PER_USER_LIMIT', 'v1 supports per_user_limit=1 only');
    }
    out.per_user_limit = 1;
  }

  if (!partial || has('starts_at')) {
    out.starts_at = parseOptionalDateTime(body.starts_at, 'starts_at');
  }
  if (!partial || has('expires_at')) {
    out.expires_at = parseOptionalDateTime(body.expires_at, 'expires_at');
  }
  if (!partial || has('is_active')) {
    const raw = !partial && !has('is_active') ? true : body.is_active;
    out.is_active = parseBooleanInput(raw, 'is_active');
  }

  return out;
}

function promoSchemaUnavailableStatus(error) {
  const code = String(error?.code || '');
  return code === '42P01' || code === '3D000';
}

function normalizeIdempotencyKey(req, rawBody) {
  const body = asObject(rawBody);
  const headerRaw = req.headers['idempotency-key'];
  const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const fromBody = body.idempotency_key;
  const normalized = String(fromBody || headerValue || '').trim();
  return normalized || null;
}

function normalizePromoBenefitJson(rawBenefit) {
  const benefit = asObject(rawBenefit);
  return benefit;
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function toCleanText(value, maxLen = 128) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim();
}

function toIsoOrNull(value) {
  if (!value) return null;
  const asDate = toEventTime(value);
  if (!asDate || Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString();
}

function mapEntitlementRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || '').trim(),
    kind: String(row.kind || '').trim(),
    scope: String(row.scope || '').trim() || 'global',
    payload: asObject(row.payload),
    starts_at: toIsoOrNull(row.starts_at),
    ends_at: toIsoOrNull(row.ends_at),
    revoked_at: toIsoOrNull(row.revoked_at)
  };
}

function isEntitlementActive(entitlement, nowMs = Date.now()) {
  if (!entitlement) return false;
  if (entitlement.revoked_at) return false;
  const startsAtMs = entitlement.starts_at ? Date.parse(entitlement.starts_at) : null;
  const endsAtMs = entitlement.ends_at ? Date.parse(entitlement.ends_at) : null;
  if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return false;
  if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) return false;
  return true;
}

function mapPromoHistoryRow(row) {
  if (!row) return null;
  const entitlement = mapEntitlementRow({
    id: row.entitlement_id,
    kind: row.entitlement_kind,
    scope: row.entitlement_scope,
    payload: row.entitlement_payload,
    starts_at: row.entitlement_starts_at,
    ends_at: row.entitlement_ends_at,
    revoked_at: row.entitlement_revoked_at
  });
  const nowMs = Date.now();
  return {
    redemption_id: String(row.redemption_id || '').trim(),
    code: String(row.code || '').trim() || null,
    benefit_type: String(row.benefit_type || '').trim() || null,
    benefit_snapshot: asObject(row.benefit_snapshot),
    redeemed_at: toIsoOrNull(row.redeemed_at),
    entitlement,
    status: entitlement ? (isEntitlementActive(entitlement, nowMs) ? 'active' : 'inactive') : 'unknown'
  };
}

const PROMO_ONLY_PLAN_TIERS = new Set(['individual']);

function normalizePlanTier(value, fallback = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return normalized || String(fallback || '').trim().toLowerCase();
}

function formatPlanTitle(planTier) {
  const normalized = normalizePlanTier(planTier, 'pro');
  if (normalized === 'pro') return 'Pro Plan';
  if (normalized === 'team') return 'Team Plan';
  if (normalized === 'individual') return 'Individual Plan';
  const words = normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return `${words.join(' ') || 'Custom'} Plan`;
}

function resolveEntitlementPlanTier(benefit, fallback = 'pro') {
  const payload = asObject(benefit?.payload);
  return normalizePlanTier(payload.plan || '', fallback);
}

function resolveBillingPlanSummary(activeBenefits) {
  const benefits = Array.isArray(activeBenefits) ? activeBenefits : [];
  const lifetimeBenefit = benefits.find((item) => item.kind === 'lifetime');
  if (lifetimeBenefit) {
    const planTier = resolveEntitlementPlanTier(lifetimeBenefit, 'pro');
    const promoOnly = PROMO_ONLY_PLAN_TIERS.has(planTier);
    return {
      tier: planTier,
      title: formatPlanTitle(planTier),
      status: 'active',
      description: promoOnly ? 'Activated via promo code only' : 'Lifetime access via promo code',
      renews_at: null,
      source: 'promo_code',
      promo_only: promoOnly
    };
  }
  const trialBenefit = benefits.find((item) => item.kind === 'trial');
  if (trialBenefit) {
    const planTier = resolveEntitlementPlanTier(trialBenefit, 'pro');
    const promoOnly = PROMO_ONLY_PLAN_TIERS.has(planTier);
    const baseTitle = formatPlanTitle(planTier).replace(/\s+Plan$/i, '');
    return {
      tier: `${planTier}_trial`,
      title: `${baseTitle || 'Plan'} Trial`,
      status: 'active',
      description: promoOnly ? 'Promo-only trial access is active' : 'Trial access is active',
      renews_at: trialBenefit.ends_at || null,
      source: 'promo_code',
      promo_only: promoOnly
    };
  }
  return {
    tier: 'free',
    title: 'Free Plan',
    status: 'active',
    description: 'Upgrade to unlock more features',
    renews_at: null,
    source: null,
    promo_only: false
  };
}

function buildPromoEntitlement({ benefitType, benefit, now }) {
  const safeType = String(benefitType || '').trim();
  const safeBenefit = normalizePromoBenefitJson(benefit);
  const scope = toCleanText(safeBenefit.scope || 'global', 64) || 'global';
  const nowDate = toEventTime(now || Date.now());

  if (safeType === 'percent_discount') {
    const rawPercent = Number(
      safeBenefit.percent
      ?? safeBenefit.discount_percent
      ?? safeBenefit.value
      ?? safeBenefit.amount
    );
    if (!Number.isFinite(rawPercent) || rawPercent <= 0 || rawPercent > 100) {
      throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', 'Promo percent discount must be between 0 and 100');
    }
    const percent = Number(rawPercent.toFixed(4));
    return {
      kind: 'discount',
      scope,
      payload: { percent },
      startsAtIso: nowDate.toISOString(),
      endsAtIso: null,
      benefitSnapshot: {
        benefit_type: safeType,
        benefit: safeBenefit,
        entitlement: { kind: 'discount', scope, payload: { percent } }
      }
    };
  }

  if (safeType === 'trial_days') {
    const trialDays = toPositiveInt(safeBenefit.trial_days ?? safeBenefit.days ?? safeBenefit.value);
    if (!trialDays || trialDays > PROMO_TRIAL_MAX_DAYS) {
      throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', `Promo trial_days must be between 1 and ${PROMO_TRIAL_MAX_DAYS}`);
    }
    const endsAt = new Date(nowDate.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const plan = toCleanText(safeBenefit.plan || '', 64);
    const payload = plan ? { trial_days: trialDays, plan } : { trial_days: trialDays };
    return {
      kind: 'trial',
      scope,
      payload,
      startsAtIso: nowDate.toISOString(),
      endsAtIso: endsAt,
      benefitSnapshot: {
        benefit_type: safeType,
        benefit: safeBenefit,
        entitlement: { kind: 'trial', scope, payload, ends_at: endsAt }
      }
    };
  }

  if (safeType === 'lifetime_access') {
    const plan = toCleanText(safeBenefit.plan || '', 64);
    if (!plan) {
      throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', 'Promo lifetime_access requires a plan');
    }
    const payload = { plan, lifetime: true };
    return {
      kind: 'lifetime',
      scope,
      payload,
      startsAtIso: nowDate.toISOString(),
      endsAtIso: null,
      benefitSnapshot: {
        benefit_type: safeType,
        benefit: safeBenefit,
        entitlement: { kind: 'lifetime', scope, payload }
      }
    };
  }

  if (safeType === 'credits') {
    const credits = toPositiveInt(safeBenefit.credits ?? safeBenefit.value ?? safeBenefit.amount);
    if (!credits) {
      throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', 'Promo credits must be a positive integer');
    }
    const payload = { credits };
    return {
      kind: 'credits',
      scope,
      payload,
      startsAtIso: nowDate.toISOString(),
      endsAtIso: null,
      benefitSnapshot: {
        benefit_type: safeType,
        benefit: safeBenefit,
        entitlement: { kind: 'credits', scope, payload }
      }
    };
  }

  if (safeType === 'feature_access') {
    const rawFeatures = Array.isArray(safeBenefit.features)
      ? safeBenefit.features
      : (safeBenefit.feature ? [safeBenefit.feature] : []);
    const features = rawFeatures
      .map((item) => toCleanText(item, 64))
      .filter(Boolean);
    if (!features.length) {
      throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', 'Promo feature_access requires at least one feature');
    }
    const payload = { features };
    return {
      kind: 'feature_access',
      scope,
      payload,
      startsAtIso: nowDate.toISOString(),
      endsAtIso: null,
      benefitSnapshot: {
        benefit_type: safeType,
        benefit: safeBenefit,
        entitlement: { kind: 'feature_access', scope, payload }
      }
    };
  }

  throw new PromoApiError(400, 'PROMO_BENEFIT_INVALID', `Unsupported promo benefit type: ${safeType || 'unknown'}`);
}

async function readEntitlementByRedemption(client, redemptionId) {
  const result = await client.query(
    `
      SELECT id, kind, scope, payload, starts_at, ends_at, revoked_at
      FROM user_entitlements
      WHERE source_type = 'promo_code'
        AND source_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [redemptionId]
  );
  return mapEntitlementRow(result.rows[0] || null);
}

function buildPromoResultPayload({ status, promo, redemption, entitlement }) {
  const promoCode = toCleanText(promo?.code || '', PROMO_CODE_MAX_LEN);
  const benefit = asObject(redemption?.benefit_snapshot);
  return {
    status,
    redeemed: status === 'redeemed',
    already_redeemed: status === 'already_redeemed',
    promo_code: promoCode || null,
    promo: {
      id: String(promo?.id || '').trim(),
      code: promoCode || null,
      benefit_type: String(promo?.benefit_type || '').trim() || null
    },
    redemption_id: String(redemption?.id || '').trim() || null,
    benefit,
    entitlement: entitlement || null,
    redeemed_at: toIsoOrNull(redemption?.created_at)
  };
}

async function redeemPromoCodeTransaction({ userId, code, idempotencyKey }) {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    throw new PromoApiError(promoStorage.statusCode, promoStorage.code, promoStorage.message);
  }
  const { pool } = promoStorage;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${PROMO_QUERY_TIMEOUT_MS}`);
    const nowResult = await client.query('SELECT now() AS now_ts');
    const nowTs = toEventTime(nowResult.rows[0]?.now_ts || Date.now());

    if (idempotencyKey) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
      const existingByIdem = await client.query(
        `
          SELECT id, promo_code_id, user_id, benefit_snapshot, created_at
          FROM promo_redemptions
          WHERE idempotency_key = $1
          LIMIT 1
          FOR UPDATE
        `,
        [idempotencyKey]
      );
      if (existingByIdem.rowCount > 0) {
        const redemption = existingByIdem.rows[0];
        if (String(redemption.user_id || '').trim() !== userId) {
          throw new PromoApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key is already used by another user');
        }
        const promoRowResult = await client.query(
          `
            SELECT id, code, benefit_type
            FROM promo_codes
            WHERE id = $1
            LIMIT 1
          `,
          [redemption.promo_code_id]
        );
        const entitlement = await readEntitlementByRedemption(client, redemption.id);
        await client.query('COMMIT');
        return buildPromoResultPayload({
          status: 'already_redeemed',
          promo: promoRowResult.rows[0] || {},
          redemption,
          entitlement
        });
      }
    }

    const promoResult = await client.query(
      `
        SELECT
          id,
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          starts_at,
          expires_at,
          is_active
        FROM promo_codes
        WHERE code = $1
        FOR UPDATE
      `,
      [code]
    );
    if (promoResult.rowCount <= 0) {
      throw new PromoApiError(404, 'PROMO_NOT_FOUND', 'Promo code not found');
    }
    const promo = promoResult.rows[0];
    if (!promo.is_active) {
      throw new PromoApiError(400, 'PROMO_INACTIVE', 'Promo code is inactive');
    }
    const startsAt = promo.starts_at ? toEventTime(promo.starts_at) : null;
    const expiresAt = promo.expires_at ? toEventTime(promo.expires_at) : null;
    if (startsAt && startsAt.getTime() > nowTs.getTime()) {
      throw new PromoApiError(400, 'PROMO_NOT_STARTED', 'Promo code is not active yet');
    }
    if (expiresAt && expiresAt.getTime() <= nowTs.getTime()) {
      throw new PromoApiError(400, 'PROMO_EXPIRED', 'Promo code has expired');
    }

    const totalUsesResult = await client.query(
      `
        SELECT count(*)::int AS count
        FROM promo_redemptions
        WHERE promo_code_id = $1
      `,
      [promo.id]
    );
    const totalUses = asCount(totalUsesResult.rows[0]?.count);
    const maxRedemptions = promo.max_redemptions === null || promo.max_redemptions === undefined
      ? null
      : asCount(promo.max_redemptions);
    if (maxRedemptions !== null && totalUses >= maxRedemptions) {
      throw new PromoApiError(409, 'PROMO_LIMIT_REACHED', 'Promo redemption limit reached');
    }

    const userUsesResult = await client.query(
      `
        SELECT count(*)::int AS count
        FROM promo_redemptions
        WHERE promo_code_id = $1
          AND user_id = $2
      `,
      [promo.id, userId]
    );
    const userUses = asCount(userUsesResult.rows[0]?.count);
    const rawPerUserLimit = Math.max(1, asCount(promo.per_user_limit || 1));
    const perUserLimit = 1; // v1 schema enforces unique (promo_code_id, user_id)
    if (rawPerUserLimit > 1) {
      logError({
        type: 'promo_per_user_limit_ignored',
        promoId: String(promo.id || ''),
        configured: rawPerUserLimit,
        effective: perUserLimit
      });
    }
    if (userUses >= perUserLimit) {
      const existingRedemptionResult = await client.query(
        `
          SELECT id, benefit_snapshot, created_at
          FROM promo_redemptions
          WHERE promo_code_id = $1
            AND user_id = $2
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [promo.id, userId]
      );
      const existingRedemption = existingRedemptionResult.rows[0] || {
        id: null,
        benefit_snapshot: promo.benefit || {},
        created_at: nowTs.toISOString()
      };
      const entitlement = existingRedemption.id
        ? await readEntitlementByRedemption(client, existingRedemption.id)
        : null;
      await client.query('COMMIT');
      return buildPromoResultPayload({
        status: 'already_redeemed',
        promo,
        redemption: existingRedemption,
        entitlement
      });
    }

    const entitlementDraft = buildPromoEntitlement({
      benefitType: promo.benefit_type,
      benefit: promo.benefit,
      now: nowTs
    });

    if (entitlementDraft.kind === 'lifetime') {
      const existingLifetime = await client.query(
        `
          SELECT id
          FROM user_entitlements
          WHERE user_id = $1
            AND kind = 'lifetime'
            AND revoked_at IS NULL
          LIMIT 1
        `,
        [userId]
      );
      if (existingLifetime.rowCount > 0) {
        throw new PromoApiError(409, 'PROMO_ENTITLEMENT_CONFLICT', 'User already has active lifetime access');
      }
    }

    const redemptionId = uuidv4();
    const redemptionInsert = await client.query(
      `
        INSERT INTO promo_redemptions (
          id,
          promo_code_id,
          user_id,
          idempotency_key,
          benefit_snapshot
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (promo_code_id, user_id) DO NOTHING
        RETURNING id, benefit_snapshot, created_at
      `,
      [
        redemptionId,
        promo.id,
        userId,
        idempotencyKey,
        JSON.stringify(entitlementDraft.benefitSnapshot)
      ]
    );

    let redemption = redemptionInsert.rows[0] || null;
    let status = 'redeemed';
    if (!redemption) {
      const existingRedemptionResult = await client.query(
        `
          SELECT id, benefit_snapshot, created_at
          FROM promo_redemptions
          WHERE promo_code_id = $1
            AND user_id = $2
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [promo.id, userId]
      );
      redemption = existingRedemptionResult.rows[0] || {
        id: null,
        benefit_snapshot: entitlementDraft.benefitSnapshot,
        created_at: nowTs.toISOString()
      };
      status = 'already_redeemed';
    }

    let entitlement = null;
    if (status === 'redeemed') {
      const entitlementInsert = await client.query(
        `
          INSERT INTO user_entitlements (
            id,
            user_id,
            kind,
            scope,
            source_type,
            source_id,
            payload,
            starts_at,
            ends_at
          )
          VALUES ($1, $2, $3, $4, 'promo_code', $5, $6::jsonb, $7::timestamptz, $8::timestamptz)
          RETURNING id, kind, scope, payload, starts_at, ends_at, revoked_at
        `,
        [
          uuidv4(),
          userId,
          entitlementDraft.kind,
          entitlementDraft.scope,
          redemption.id,
          JSON.stringify(entitlementDraft.payload),
          entitlementDraft.startsAtIso,
          entitlementDraft.endsAtIso
        ]
      );
      entitlement = mapEntitlementRow(entitlementInsert.rows[0] || null);
      await client.query(
        `
          UPDATE promo_codes
          SET redeemed_count = redeemed_count + 1
          WHERE id = $1
        `,
        [promo.id]
      );
    } else if (redemption.id) {
      entitlement = await readEntitlementByRedemption(client, redemption.id);
    }

    await client.query('COMMIT');
    return buildPromoResultPayload({
      status,
      promo,
      redemption,
      entitlement
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // noop
    }
    throw error;
  } finally {
    client.release();
  }
}

function normalizeEventName(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'unknown_event';
}

function normalizeLocale(value, req) {
  const direct = String(value || '').trim().toLowerCase();
  if (direct) return direct.slice(0, 32);
  const accept = String(req.headers['accept-language'] || '').split(',')[0].trim().toLowerCase();
  return accept.slice(0, 32);
}

function inferDevice(value, req) {
  const direct = String(value || '').trim().toLowerCase();
  if (direct) return direct.slice(0, 24);
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function toEventTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const asDate = new Date(ms);
    if (!Number.isNaN(asDate.getTime())) return asDate;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function isoDateTimeMs(value) {
  return toEventTime(value).toISOString();
}

function hashIp(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function normalizeQuery(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[→⇒➡]/g, ' ')
    .replace(/\s*(?:->|=>)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAnalyticsEnvelope(req, body) {
  const raw = asObject(body);
  const rawPayload = asObject(raw.payload);
  const rawProperties = asObject(raw.properties);
  const properties = Object.keys(rawProperties).length ? rawProperties : rawPayload;
  const schemaVersionRaw = Number(raw.schema_version ?? properties.schema_version ?? 1);
  const schemaVersion = Number.isFinite(schemaVersionRaw) && schemaVersionRaw > 0
    ? Math.floor(schemaVersionRaw)
    : 1;

  const eventName = normalizeEventName(raw.event || raw.type || '');
  const queryRaw = properties.query_raw || properties.query || '';
  const queryNorm = properties.query_norm || normalizeQuery(queryRaw);
  const fromFormat = String(properties.from_format || properties.from || '').toLowerCase().trim();
  const toFormat = String(properties.to_format || properties.to || '').toLowerCase().trim();
  const matchesRaw = Number(properties.matches_count ?? properties.matches ?? 0);
  const matchesCount = Number.isFinite(matchesRaw) && matchesRaw >= 0 ? Math.min(255, Math.floor(matchesRaw)) : 0;
  const redirected = Boolean(properties.redirected || properties.redirectTool || properties.redirect_tool || eventName === 'search_redirect');
  const toolId = String(properties.tool_id || properties.redirectTool || properties.redirect_tool || '').trim();
  const parseSuccess = properties.parse_success === true || properties.parsed === true || (fromFormat && toFormat);
  const latencyRaw = Number(properties.latency_ms || 0);
  const latencyMs = Number.isFinite(latencyRaw) && latencyRaw >= 0 ? Math.floor(latencyRaw) : 0;
  const ingestionSource = String(raw.ingestion_source || properties.ingestion_source || 'client').trim().toLowerCase() || 'client';

  return {
    eventName,
    eventTime: isoDateTimeMs(raw.timestamp || raw.ts || Date.now()),
    sessionId: String(raw.session_id || properties.session_id || req.headers['x-session-id'] || uuidv4()).trim(),
    userId: String(raw.user_id || properties.user_id || req.headers['x-user-id'] || '').trim() || null,
    page: String(raw.page || properties.page || '').trim(),
    source: String(raw.source || properties.source || '').trim(),
    locale: normalizeLocale(raw.locale || properties.locale, req),
    device: inferDevice(raw.device || properties.device, req),
    requestId: req.requestId || null,
    ipHash: hashIp(req),
    userAgent: String(req.headers['user-agent'] || '').trim() || null,
    schemaVersion,
    ingestionSource,
    canonicalProps: {
      ...properties,
      schema_version: schemaVersion,
      ingestion_source: ingestionSource,
      query_raw: queryRaw || undefined,
      query_norm: queryNorm || undefined,
      from_format: fromFormat || undefined,
      to_format: toFormat || undefined,
      matches_count: matchesCount,
      redirected: redirected ? true : undefined,
      tool_id: toolId || undefined,
      parse_success: parseSuccess ? true : undefined,
      latency_ms: latencyMs > 0 ? latencyMs : undefined
    }
  };
}

function buildAnalyticsRowsFromEnvelope(envelope) {
  const baseRow = {
    ingest_time: isoDateTimeMs(Date.now()),
    event_time: envelope.eventTime,
    session_id: envelope.sessionId,
    user_id: envelope.userId,
    page: envelope.page,
    source: envelope.source,
    locale: envelope.locale,
    device: envelope.device,
    ingestion_source: envelope.ingestionSource,
    schema_version: envelope.schemaVersion,
    request_id: envelope.requestId,
    ip_hash: envelope.ipHash,
    user_agent: envelope.userAgent
  };

  const withEvent = (eventName, properties, ingestionSource = baseRow.ingestion_source) => ({
    ...baseRow,
    event_id: uuidv4(),
    event_name: normalizeEventName(eventName),
    ingestion_source: ingestionSource,
    properties_json: JSON.stringify(properties || {})
  });

  const events = [withEvent(envelope.eventName, envelope.canonicalProps)];
  if (envelope.eventName === 'tool_search') {
    const p = envelope.canonicalProps;
    const expandedBase = { ...p, ingestion_source: 'legacy_expand' };
    events.push(withEvent('search_submit', expandedBase, 'legacy_expand'));
    if (p.parse_success) events.push(withEvent('search_parsed', expandedBase, 'legacy_expand'));
    if (Object.prototype.hasOwnProperty.call(p, 'matches_count')) {
      events.push(withEvent('search_results', expandedBase, 'legacy_expand'));
    }
    if (p.redirected || p.tool_id) {
      events.push(withEvent('search_redirect', {
        ...expandedBase,
        redirected: true,
        redirect_reason: p.redirect_reason || 'single_match'
      }, 'legacy_expand'));
    }
  }

  return events;
}

function buildClickHouseInsertQuery() {
  return `INSERT INTO ${CLICKHOUSE_DATABASE}.${CLICKHOUSE_TABLE} FORMAT JSONEachRow`;
}

function buildClickHouseUrl() {
  const base = CLICKHOUSE_URL.replace(/\/+$/, '');
  return `${base}/?query=${encodeURIComponent(buildClickHouseInsertQuery())}`;
}

function buildClickHouseSelectUrl(sql) {
  const base = CLICKHOUSE_URL.replace(/\/+$/, '');
  const query = `USE ${CLICKHOUSE_DATABASE}; ${sql}`;
  return `${base}/?default_format=JSON&query=${encodeURIComponent(query)}`;
}

function buildClickHouseHeaders() {
  const headers = {
    'Content-Type': 'application/x-ndjson'
  };
  if (CLICKHOUSE_USER || CLICKHOUSE_PASSWORD) {
    const token = Buffer.from(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

async function insertAnalyticsBatch(rows) {
  if (!rows.length) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYTICS_INSERT_TIMEOUT_MS);
  try {
    const body = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    const resp = await fetch(buildClickHouseUrl(), {
      method: 'POST',
      headers: buildClickHouseHeaders(),
      body,
      signal: controller.signal
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`clickhouse_insert_failed status=${resp.status} detail=${detail.slice(0, 400)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function queryClickHouse(sql) {
  if (!CLICKHOUSE_URL) throw new Error('clickhouse_not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYTICS_QUERY_TIMEOUT_MS);
  try {
    const resp = await fetch(buildClickHouseSelectUrl(sql), {
      method: 'POST',
      headers: buildClickHouseHeaders(),
      signal: controller.signal
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      throw new Error(`clickhouse_query_failed status=${resp.status} detail=${bodyText.slice(0, 400)}`);
    }
    const parsed = bodyText ? JSON.parse(bodyText) : { data: [] };
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } finally {
    clearTimeout(timer);
  }
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratioOrNull(numerator, denominator) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return Number((num / den).toFixed(4));
}

function resolveSearchRange(rawRange) {
  const range = String(rawRange || '7d').toLowerCase().trim();
  const rangeDurationMs = SEARCH_RANGE_DURATIONS_MS[range];
  if (SEARCH_RANGE_WINDOWS[range]) {
    return {
      range,
      rangeStartSql: SEARCH_RANGE_WINDOWS[range],
      rangeDurationMs
    };
  }
  return {
    range: '7d',
    rangeStartSql: SEARCH_RANGE_WINDOWS['7d'],
    rangeDurationMs: SEARCH_RANGE_DURATIONS_MS['7d']
  };
}

function isClickHouseAnalyticsEnabled() {
  return Boolean(ANALYTICS_ENABLED && CLICKHOUSE_URL);
}

function canUseAnalyticsFallback() {
  return Boolean(ANALYTICS_USE_FALLBACK && ANALYTICS_FALLBACK_FILE);
}

function shouldWriteAnalyticsFallback() {
  return Boolean(canUseAnalyticsFallback() && ANALYTICS_FALLBACK_INGEST_ENABLED);
}

function analyticsUnavailablePayload(requestId) {
  return {
    status: 'error',
    code: 'ANALYTICS_UNAVAILABLE',
    message: 'Analytics backend is not configured',
    requestId
  };
}

function safeParseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function asAnalyticsInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback);
  if (n < 0) return 0;
  return Math.floor(n);
}

function asAnalyticsBool(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function asAnalyticsEventTimeMs(value) {
  const date = toEventTime(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function toUtcDayKey(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function startOfUtcDayMs(timestampMs = Date.now()) {
  const date = new Date(timestampMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
}

function startOfUtcHourMs(timestampMs = Date.now()) {
  const date = new Date(timestampMs);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0
  );
}

function quantile(values, q) {
  const sorted = Array.isArray(values) ? [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b) : [];
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const clampedQ = Math.max(0, Math.min(1, Number(q)));
  const idx = (sorted.length - 1) * clampedQ;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] + ((sorted[hi] - sorted[lo]) * weight);
}

function counterTopRows(counter, keyName, limit = 20) {
  return Array.from(counter.entries())
    .map(([key, count]) => ({
      [keyName]: key,
      count: asCount(count)
    }))
    .filter((row) => row[keyName])
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return String(left[keyName]).localeCompare(String(right[keyName]));
    })
    .slice(0, Math.max(1, Number(limit) || 1));
}

function decodeAnalyticsEventRow(rawRow) {
  const row = asObject(rawRow);
  const props = safeParseJsonObject(row.properties_json);
  const eventName = normalizeEventName(row.event_name);
  const sessionId = String(row.session_id || props.session_id || '').trim();
  if (!sessionId) return null;

  const queryRaw = String(row.query_raw || props.query_raw || props.query || '').trim();
  const queryNorm = String(row.query_norm || props.query_norm || normalizeQuery(queryRaw)).trim();
  const fromFormat = String(row.from_format || props.from_format || props.from || '').trim().toLowerCase();
  const toFormat = String(row.to_format || props.to_format || props.to || '').trim().toLowerCase();
  const toolId = String(row.tool_id || props.tool_id || props.redirectTool || props.redirect_tool || '').trim();
  const source = String(row.source || props.source || '').trim().toLowerCase();

  return {
    event_name: eventName,
    event_time_ms: asAnalyticsEventTimeMs(row.event_time),
    event_time: isoDateTimeMs(row.event_time),
    session_id: sessionId,
    user_id: String(row.user_id || props.user_id || '').trim() || null,
    source,
    locale: String(row.locale || props.locale || '').trim().toLowerCase(),
    device: String(row.device || props.device || '').trim().toLowerCase(),
    ingestion_source: String(row.ingestion_source || props.ingestion_source || 'client').trim().toLowerCase() || 'client',
    query_raw: queryRaw,
    query_norm: queryNorm,
    from_format: fromFormat,
    to_format: toFormat,
    tool_id: toolId,
    parse_success: asAnalyticsBool(row.parse_success ?? props.parse_success),
    matches_count: asAnalyticsInt(row.matches_count ?? props.matches_count ?? props.matches, 0),
    redirected: asAnalyticsBool(row.redirected ?? props.redirected ?? (eventName === 'search_redirect')),
    latency_ms: asAnalyticsInt(row.latency_ms ?? props.latency_ms, 0)
  };
}

function appendAnalyticsFallbackRows(rows) {
  if (!shouldWriteAnalyticsFallback()) return;
  if (!Array.isArray(rows) || !rows.length) return;
  const jsonl = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  analyticsFallbackWriteQueue = analyticsFallbackWriteQueue
    .then(async () => {
      await fs.promises.mkdir(path.dirname(ANALYTICS_FALLBACK_FILE), { recursive: true });
      await fs.promises.appendFile(ANALYTICS_FALLBACK_FILE, jsonl, 'utf8');
    })
    .catch((error) => {
      logError({
        type: 'analytics_fallback_write_failed',
        error: error?.message || 'unknown'
      });
    });
}

async function readAnalyticsFallbackEvents(maxRows = ANALYTICS_FALLBACK_MAX_ROWS) {
  if (!canUseAnalyticsFallback()) return [];
  try {
    const raw = await fs.promises.readFile(ANALYTICS_FALLBACK_FILE, 'utf8');
    if (!raw) return [];
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-Math.max(1000, Number(maxRows) || ANALYTICS_FALLBACK_MAX_ROWS));
    const events = [];
    for (const line of tail) {
      let parsed = null;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const event = decodeAnalyticsEventRow(parsed);
      if (event) events.push(event);
    }
    return events;
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    logError({
      type: 'analytics_fallback_read_failed',
      error: error?.message || 'unknown'
    });
    throw error;
  }
}

function isNonLegacySearchEvent(event) {
  return event.ingestion_source !== 'legacy_expand';
}

function buildSearchInsightsFromEvents(events, {
  startMs,
  endMs = Date.now(),
  queryLimit = 20,
  formatLimit = 10,
  pairLimit = 12,
  includeDaily = true
} = {}) {
  const beginMs = Number.isFinite(startMs) ? startMs : (Date.now() - SEARCH_RANGE_DURATIONS_MS['7d']);
  const finishMs = Number.isFinite(endMs) ? endMs : Date.now();

  let submitCount = 0;
  let parsedSuccessCount = 0;
  let resultsCount = 0;
  let zeroResultsCount = 0;
  let redirectsCount = 0;
  let toolOpensFromSearch = 0;

  const topQueriesCounter = new Map();
  const zeroQueriesCounter = new Map();
  const topFromCounter = new Map();
  const topToCounter = new Map();
  const topPairsCounter = new Map();
  const dailyCounter = new Map();
  const sessionSubmitTimes = new Map();
  const sessionToolOpenTimes = new Map();
  const sessionRedirectTimes = new Map();
  const latencyValues = [];

  const ensureDay = (day) => {
    if (!dailyCounter.has(day)) {
      dailyCounter.set(day, {
        searches: 0,
        zero_results: 0,
        redirects: 0,
        tool_opens: 0
      });
    }
    return dailyCounter.get(day);
  };

  for (const event of events) {
    const ts = Number(event?.event_time_ms || 0);
    if (!Number.isFinite(ts) || ts < beginMs || ts > finishMs) continue;

    const eventName = String(event.event_name || '');
    const day = toUtcDayKey(ts);
    const daily = includeDaily ? ensureDay(day) : null;
    const isSearchScope = isNonLegacySearchEvent(event);

    if (eventName === 'search_submit' && isSearchScope) {
      submitCount += 1;
      if (daily) daily.searches += 1;
      const query = String(event.query_norm || '').trim();
      if (query) topQueriesCounter.set(query, (topQueriesCounter.get(query) || 0) + 1);
      if (!sessionSubmitTimes.has(event.session_id)) sessionSubmitTimes.set(event.session_id, []);
      sessionSubmitTimes.get(event.session_id).push(ts);
      if (event.latency_ms > 0) latencyValues.push(event.latency_ms);
      continue;
    }

    if (eventName === 'search_parsed' && isSearchScope) {
      if (event.parse_success) parsedSuccessCount += 1;
      const from = String(event.from_format || '').trim().toLowerCase();
      const to = String(event.to_format || '').trim().toLowerCase();
      if (from) topFromCounter.set(from, (topFromCounter.get(from) || 0) + 1);
      if (to) topToCounter.set(to, (topToCounter.get(to) || 0) + 1);
      if (from && to) {
        const pairKey = `${from} -> ${to}`;
        topPairsCounter.set(pairKey, (topPairsCounter.get(pairKey) || 0) + 1);
      }
      continue;
    }

    if (eventName === 'search_results' && isSearchScope) {
      resultsCount += 1;
      if (event.matches_count <= 0) {
        zeroResultsCount += 1;
        if (daily) daily.zero_results += 1;
        const query = String(event.query_norm || '').trim();
        if (query) zeroQueriesCounter.set(query, (zeroQueriesCounter.get(query) || 0) + 1);
      }
      continue;
    }

    if (eventName === 'search_redirect' && isSearchScope) {
      redirectsCount += 1;
      if (daily) daily.redirects += 1;
      if (!sessionRedirectTimes.has(event.session_id)) sessionRedirectTimes.set(event.session_id, []);
      sessionRedirectTimes.get(event.session_id).push(ts);
      continue;
    }

    if (eventName === 'tool_open' && event.source === 'search') {
      toolOpensFromSearch += 1;
      if (daily) daily.tool_opens += 1;
      if (!sessionToolOpenTimes.has(event.session_id)) sessionToolOpenTimes.set(event.session_id, []);
      sessionToolOpenTimes.get(event.session_id).push(ts);
    }
  }

  let convertedSessions = 0;
  let redirectSuccessCount = 0;
  const timeToToolSeconds = [];
  const searchSessionIds = Array.from(sessionSubmitTimes.keys());

  for (const sessionId of searchSessionIds) {
    const submitTimes = sessionSubmitTimes.get(sessionId) || [];
    submitTimes.sort((a, b) => a - b);
    const firstSubmit = submitTimes[0];
    const opens = (sessionToolOpenTimes.get(sessionId) || []).sort((a, b) => a - b);
    const convertedOpen = opens.find((openTs) => openTs >= firstSubmit && openTs <= (firstSubmit + (30 * 60 * 1000)));
    if (convertedOpen) {
      convertedSessions += 1;
      timeToToolSeconds.push(Math.round((convertedOpen - firstSubmit) / 1000));
    }

  }

  for (const [sessionId, redirects] of sessionRedirectTimes.entries()) {
    const submitTimes = (sessionSubmitTimes.get(sessionId) || []).sort((a, b) => a - b);
    for (const redirectTs of redirects.sort((a, b) => a - b)) {
      const retryIn30s = submitTimes.find((submitTs) => submitTs > redirectTs && submitTs <= (redirectTs + 30_000));
      if (!retryIn30s) redirectSuccessCount += 1;
    }
  }

  const allSessionIds = new Set();
  for (const event of events) {
    const ts = Number(event?.event_time_ms || 0);
    if (!Number.isFinite(ts) || ts < beginMs || ts > finishMs) continue;
    if (event.session_id) allSessionIds.add(event.session_id);
  }

  const sortedLatency = latencyValues
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(-ANALYTICS_FALLBACK_MAX_LATENCY_POINTS);
  const p50LatencyMs = quantile(sortedLatency, 0.5);
  const p95LatencyMs = quantile(sortedLatency, 0.95);
  const p50TimeToToolSec = quantile(timeToToolSeconds, 0.5);
  const p95TimeToToolSec = quantile(timeToToolSeconds, 0.95);

  const dailyRows = [];
  if (includeDaily) {
    let cursor = startOfUtcDayMs(beginMs);
    const endDay = startOfUtcDayMs(finishMs);
    while (cursor <= endDay) {
      const day = toUtcDayKey(cursor);
      const point = dailyCounter.get(day) || {
        searches: 0,
        zero_results: 0,
        redirects: 0,
        tool_opens: 0
      };
      dailyRows.push({
        day,
        searches: asCount(point.searches),
        zero_results: asCount(point.zero_results),
        redirects: asCount(point.redirects),
        tool_opens: asCount(point.tool_opens)
      });
      cursor += 24 * 60 * 60 * 1000;
    }
  }

  const uniqueSearchSessions = searchSessionIds.length;
  const searchAdoptionPct = allSessionIds.size > 0
    ? Number((uniqueSearchSessions / allSessionIds.size).toFixed(4))
    : null;
  const parseRatePct = submitCount > 0
    ? Number((parsedSuccessCount / submitCount).toFixed(4))
    : null;
  const zeroResultRatePct = resultsCount > 0
    ? Number((zeroResultsCount / resultsCount).toFixed(4))
    : null;
  const conversionPct = uniqueSearchSessions > 0
    ? Number((convertedSessions / uniqueSearchSessions).toFixed(4))
    : null;
  const redirectSharePct = submitCount > 0
    ? Number((redirectsCount / submitCount).toFixed(4))
    : null;
  const redirectSuccessPct = redirectsCount > 0
    ? Number((redirectSuccessCount / redirectsCount).toFixed(4))
    : null;

  return {
    summary: {
      total_sessions: allSessionIds.size,
      search_sessions: uniqueSearchSessions,
      converted_sessions: convertedSessions,
      search_adoption_pct: searchAdoptionPct,
      parse_rate_pct: parseRatePct,
      zero_result_rate_pct: zeroResultRatePct,
      conversion_pct: conversionPct,
      redirect_share_pct: redirectSharePct,
      redirect_success_pct: redirectSuccessPct,
      p50_latency_ms: p50LatencyMs === null ? null : Math.round(p50LatencyMs),
      p95_latency_ms: p95LatencyMs === null ? null : Math.round(p95LatencyMs),
      p50_time_to_tool_sec: p50TimeToToolSec === null ? null : Math.round(p50TimeToToolSec),
      p95_time_to_tool_sec: p95TimeToToolSec === null ? null : Math.round(p95TimeToToolSec)
    },
    funnel: {
      submit: asCount(submitCount),
      parsed_success: asCount(parsedSuccessCount),
      results: asCount(resultsCount),
      zero_results: asCount(zeroResultsCount),
      redirects: asCount(redirectsCount),
      tool_open_from_search: asCount(toolOpensFromSearch)
    },
    top_queries: counterTopRows(topQueriesCounter, 'query', queryLimit),
    zero_queries: counterTopRows(zeroQueriesCounter, 'query', queryLimit),
    top_from: counterTopRows(topFromCounter, 'format', formatLimit),
    top_to: counterTopRows(topToCounter, 'format', formatLimit),
    top_pairs: counterTopRows(topPairsCounter, 'pair', pairLimit),
    daily: dailyRows
  };
}

function buildOverviewMetricsFromEvents(events) {
  const nowMs = Date.now();
  const dayStartMs = startOfUtcDayMs(nowMs);
  const minAgoMs = nowMs - (60 * 1000);
  const fiveMinAgoMs = nowMs - (5 * 60 * 1000);
  const twentyFourHoursAgoMs = nowMs - (24 * 60 * 60 * 1000);

  let eventsPerMin = 0;
  const onlineSessions = new Set();
  const topToolsCounter = new Map();
  const hourlyCounter = new Map();
  const todayEvents = [];

  for (const event of events) {
    const ts = Number(event?.event_time_ms || 0);
    if (!Number.isFinite(ts)) continue;

    if (ts >= minAgoMs) eventsPerMin += 1;
    if (ts >= fiveMinAgoMs && event.session_id) onlineSessions.add(event.session_id);
    if (ts >= dayStartMs) todayEvents.push(event);

    if (ts >= dayStartMs && event.event_name === 'tool_open') {
      const toolId = String(event.tool_id || '').trim();
      if (toolId) topToolsCounter.set(toolId, (topToolsCounter.get(toolId) || 0) + 1);
    }

    if (ts >= twentyFourHoursAgoMs) {
      const hourStart = startOfUtcHourMs(ts);
      if (!hourlyCounter.has(hourStart)) hourlyCounter.set(hourStart, { events: 0, searches: 0 });
      const bucket = hourlyCounter.get(hourStart);
      bucket.events += 1;
      if (event.event_name === 'search_submit' && isNonLegacySearchEvent(event)) {
        bucket.searches += 1;
      }
    }
  }

  const searchToday = buildSearchInsightsFromEvents(todayEvents, {
    startMs: dayStartMs,
    endMs: nowMs,
    queryLimit: 10,
    formatLimit: 8,
    pairLimit: 8,
    includeDaily: false
  });

  const hourly = [];
  let cursor = startOfUtcHourMs(twentyFourHoursAgoMs);
  const finalHour = startOfUtcHourMs(nowMs);
  while (cursor <= finalHour) {
    const point = hourlyCounter.get(cursor) || { events: 0, searches: 0 };
    hourly.push({
      hour: new Date(cursor).toISOString(),
      events: asCount(point.events),
      searches: asCount(point.searches)
    });
    cursor += 60 * 60 * 1000;
  }

  return {
    online_now: onlineSessions.size,
    events_per_min: asCount(eventsPerMin),
    searches_today: asCount(searchToday.funnel.submit),
    top_tools: counterTopRows(topToolsCounter, 'tool_id', 5),
    summary: searchToday.summary,
    funnel: searchToday.funnel,
    hourly
  };
}

async function flushAnalyticsBuffer(reason = 'manual') {
  if (!isClickHouseAnalyticsEnabled()) return;
  if (analyticsFlushInFlight) return;
  if (!analyticsBuffer.length) return;

  analyticsFlushInFlight = true;
  const batch = analyticsBuffer.splice(0, ANALYTICS_BATCH_SIZE);
  try {
    await insertAnalyticsBatch(batch);
    log({ type: 'analytics_batch_flushed', reason, count: batch.length });
  } catch (error) {
    logError({
      type: 'analytics_batch_failed',
      reason,
      count: batch.length,
      error: error?.message || 'unknown'
    });
  } finally {
    analyticsFlushInFlight = false;
    if (analyticsBuffer.length >= ANALYTICS_BATCH_SIZE) {
      setImmediate(() => {
        void flushAnalyticsBuffer('drain');
      });
    }
  }
}

function enqueueAnalyticsRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return;

  if (isClickHouseAnalyticsEnabled()) {
    for (const row of rows) {
      if (analyticsBuffer.length >= ANALYTICS_MAX_BUFFER) {
        analyticsBuffer.shift();
        logError({ type: 'analytics_buffer_overflow', maxBuffer: ANALYTICS_MAX_BUFFER });
      }
      analyticsBuffer.push(row);
    }
    if (analyticsBuffer.length >= ANALYTICS_BATCH_SIZE) {
      void flushAnalyticsBuffer('batch_size');
    }
  }

  appendAnalyticsFallbackRows(rows);
}

function startAnalyticsFlushLoop() {
  if (isClickHouseAnalyticsEnabled() && !analyticsFlushTimer) {
    analyticsFlushTimer = setInterval(() => {
      void flushAnalyticsBuffer('interval');
    }, ANALYTICS_FLUSH_INTERVAL_MS);
    if (typeof analyticsFlushTimer.unref === 'function') analyticsFlushTimer.unref();
  }

  if (isClickHouseAnalyticsEnabled()) {
    log({
      type: 'analytics_enabled',
      backend: 'clickhouse',
      clickhouseUrl: CLICKHOUSE_URL,
      database: CLICKHOUSE_DATABASE,
      table: CLICKHOUSE_TABLE,
      batchSize: ANALYTICS_BATCH_SIZE,
      flushIntervalMs: ANALYTICS_FLUSH_INTERVAL_MS
    });
  }
  if (canUseAnalyticsFallback()) {
    log({
      type: 'analytics_enabled',
      backend: 'fallback_jsonl',
      file: ANALYTICS_FALLBACK_FILE,
      maxRows: ANALYTICS_FALLBACK_MAX_ROWS,
      ingest: ANALYTICS_FALLBACK_INGEST_ENABLED
    });
  }
}

async function headObject(key) {
  if (storageMode !== 's3') return null;
  const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  return {
    size: head.ContentLength || 0,
    contentType: head.ContentType || ''
  };
}

async function ensureBucketAvailable() {
  if (storageMode !== 's3') return;
  if (bucketReady) return;
  const bucket = process.env.S3_BUCKET;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    bucketReady = true;
    return;
  } catch (headError) {
    const code = headError?.name || headError?.Code || '';
    if (code !== 'NotFound' && code !== 'NoSuchBucket' && code !== 'NotFoundException') {
      throw headError;
    }
  }
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    bucketReady = true;
    log({ type: 'bucket_created', bucket });
  } catch (createError) {
    const code = createError?.name || createError?.Code || '';
    if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') {
      bucketReady = true;
      return;
    }
    throw createError;
  }
}

app.get('/health', async (req, res) => {
  const redis = await ensureRedisAvailable(req.requestId);
  if (!redis.ok) {
    return res.status(503).json({ ok: false, storage: storageMode, redis: 'down', error: redis.payload });
  }
  return res.json({ ok: true, storage: storageMode, redis: 'up' });
});
app.post('/events', (req, res) => {
  const body = asObject(req.body);
  if (!body.type && !body.event) {
    return res.status(400).json({ status: 'error', code: 'MISSING_EVENT', message: 'Missing event', requestId: req.requestId });
  }

  const envelope = normalizeAnalyticsEnvelope(req, body);
  const rows = buildAnalyticsRowsFromEnvelope(envelope);
  enqueueAnalyticsRows(rows);

  log({
    type: 'event',
    requestId: req.requestId,
    event: envelope.eventName,
    schemaVersion: envelope.schemaVersion,
    accepted: rows.length,
    buffered: analyticsBuffer.length,
    clickhouseEnabled: isClickHouseAnalyticsEnabled(),
    fallbackEnabled: canUseAnalyticsFallback(),
    ts: envelope.eventTime
  });
  return res.json({ ok: true, accepted: rows.length, requestId: req.requestId });
});

app.post('/admin/auth/login', (req, res) => {
  if (!ADMIN_AUTH_ENABLED) {
    return res.status(503).json({
      status: 'error',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: 'Admin auth is not configured',
      requestId: req.requestId
    });
  }
  const password = String(req.body?.password || '');
  if (!password) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_PASSWORD',
      message: 'Missing password',
      requestId: req.requestId
    });
  }
  if (!timingSafeEqualText(password, ADMIN_PASSWORD)) {
    return res.status(401).json({
      status: 'error',
      code: 'ADMIN_UNAUTHORIZED',
      message: 'Invalid credentials',
      requestId: req.requestId
    });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const token = signAdminJwt({
    sub: 'admin',
    sid: uuidv4(),
    iat: nowSec,
    exp: nowSec + ADMIN_SESSION_TTL_SEC
  });
  res.setHeader('Set-Cookie', buildAdminCookie(token));
  return res.json({ ok: true, expires_in: ADMIN_SESSION_TTL_SEC });
});

app.post('/admin/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', buildAdminExpiredCookie());
  return res.json({ ok: true });
});

app.get('/admin/auth/me', requireAdminAuth, (req, res) => {
  return res.json({
    ok: true,
    admin: {
      sid: req.admin.sid || null,
      exp: req.admin.exp || null
    }
  });
});

app.get('/admin/promo-codes', requireAdminAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }
  try {
    const result = await promoStorage.pool.query(
      `
        SELECT
          id,
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          redeemed_count,
          starts_at,
          expires_at,
          is_active,
          created_at,
          updated_at
        FROM promo_codes
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [PROMO_ADMIN_LIST_LIMIT]
    );
    return res.json(result.rows.map((row) => mapPromoCodeRow(row)).filter(Boolean));
  } catch (error) {
    const code = promoSchemaUnavailableStatus(error) ? 'PROMO_SCHEMA_NOT_READY' : 'PROMO_CODES_READ_FAILED';
    const message = promoSchemaUnavailableStatus(error)
      ? 'Promo schema is not ready'
      : 'Failed to load promo codes';
    logError({
      type: 'admin_promo_codes_list_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    const statusCode = code === 'PROMO_SCHEMA_NOT_READY' ? 503 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.post('/admin/promo-codes', requireAdminAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

  try {
    const input = normalizePromoCodeAdminInput(req.body, { partial: false });
    assertPromoWindow({ startsAtIso: input.starts_at, expiresAtIso: input.expires_at });
    buildPromoEntitlement({
      benefitType: input.benefit_type,
      benefit: input.benefit,
      now: Date.now()
    });

    const result = await promoStorage.pool.query(
      `
        INSERT INTO promo_codes (
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          starts_at,
          expires_at,
          is_active
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6::timestamptz, $7::timestamptz, $8)
        RETURNING
          id,
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          redeemed_count,
          starts_at,
          expires_at,
          is_active,
          created_at,
          updated_at
      `,
      [
        input.code,
        input.benefit_type,
        JSON.stringify(input.benefit || {}),
        input.max_redemptions ?? null,
        input.per_user_limit ?? 1,
        input.starts_at ?? null,
        input.expires_at ?? null,
        input.is_active !== false
      ]
    );

    return res.status(201).json(mapPromoCodeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const pgCode = String(error?.code || '');
    if (pgCode === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'PROMO_CODE_CONFLICT',
        message: 'Promo code already exists',
        requestId: req.requestId
      });
    }
    const code = promoSchemaUnavailableStatus(error) ? 'PROMO_SCHEMA_NOT_READY' : 'PROMO_CODES_WRITE_FAILED';
    const message = promoSchemaUnavailableStatus(error)
      ? 'Promo schema is not ready'
      : 'Failed to create promo code';
    logError({
      type: 'admin_promo_codes_create_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    const statusCode = code === 'PROMO_SCHEMA_NOT_READY' ? 503 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.patch('/admin/promo-codes/:id', requireAdminAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

  const promoId = String(req.params.id || '').trim();
  if (!promoId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_PROMO_ID',
      message: 'Missing promo code id',
      requestId: req.requestId
    });
  }

  let patch;
  try {
    patch = normalizePromoCodeAdminInput(req.body, { partial: true });
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    logError({
      type: 'admin_promo_codes_patch_invalid',
      requestId: req.requestId,
      promoId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'PROMO_CODES_WRITE_FAILED',
      message: 'Failed to update promo code',
      requestId: req.requestId
    });
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      status: 'error',
      code: 'EMPTY_PATCH',
      message: 'No fields to update',
      requestId: req.requestId
    });
  }

  const client = await promoStorage.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${PROMO_QUERY_TIMEOUT_MS}`);
    const currentResult = await client.query(
      `
        SELECT
          id,
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          redeemed_count,
          starts_at,
          expires_at,
          is_active,
          created_at,
          updated_at
        FROM promo_codes
        WHERE id = $1
        FOR UPDATE
      `,
      [promoId]
    );

    if (currentResult.rowCount <= 0) {
      throw new PromoApiError(404, 'PROMO_NOT_FOUND', 'Promo code not found');
    }

    const current = currentResult.rows[0];
    const nextCode = patch.code ?? String(current.code || '').trim();
    const nextBenefitType = patch.benefit_type ?? String(current.benefit_type || '').trim();
    const nextBenefit = Object.prototype.hasOwnProperty.call(patch, 'benefit')
      ? (patch.benefit || {})
      : asObject(current.benefit);
    const nextMaxRedemptions = Object.prototype.hasOwnProperty.call(patch, 'max_redemptions')
      ? patch.max_redemptions
      : (current.max_redemptions === undefined ? null : current.max_redemptions);
    const nextPerUserLimit = Object.prototype.hasOwnProperty.call(patch, 'per_user_limit')
      ? patch.per_user_limit
      : Math.max(1, asCount(current.per_user_limit || 1));
    const nextStartsAt = Object.prototype.hasOwnProperty.call(patch, 'starts_at')
      ? patch.starts_at
      : toIsoOrNull(current.starts_at);
    const nextExpiresAt = Object.prototype.hasOwnProperty.call(patch, 'expires_at')
      ? patch.expires_at
      : toIsoOrNull(current.expires_at);
    const nextIsActive = Object.prototype.hasOwnProperty.call(patch, 'is_active')
      ? patch.is_active
      : Boolean(current.is_active);

    validatePromoCodeValue(nextCode);
    if (!PROMO_BENEFIT_TYPES.has(nextBenefitType)) {
      throw new PromoApiError(
        400,
        'INVALID_BENEFIT_TYPE',
        `benefit_type must be one of: ${Array.from(PROMO_BENEFIT_TYPES).join(', ')}`
      );
    }
    if (!nextBenefit || typeof nextBenefit !== 'object' || Array.isArray(nextBenefit)) {
      throw new PromoApiError(400, 'INVALID_BENEFIT', 'benefit must be a JSON object');
    }
    if (nextPerUserLimit !== 1) {
      throw new PromoApiError(400, 'UNSUPPORTED_PER_USER_LIMIT', 'v1 supports per_user_limit=1 only');
    }
    assertPromoWindow({ startsAtIso: nextStartsAt, expiresAtIso: nextExpiresAt });
    buildPromoEntitlement({
      benefitType: nextBenefitType,
      benefit: nextBenefit,
      now: Date.now()
    });

    const updateResult = await client.query(
      `
        UPDATE promo_codes
        SET
          code = $2,
          benefit_type = $3,
          benefit = $4::jsonb,
          max_redemptions = $5,
          per_user_limit = $6,
          starts_at = $7::timestamptz,
          expires_at = $8::timestamptz,
          is_active = $9
        WHERE id = $1
        RETURNING
          id,
          code,
          benefit_type,
          benefit,
          max_redemptions,
          per_user_limit,
          redeemed_count,
          starts_at,
          expires_at,
          is_active,
          created_at,
          updated_at
      `,
      [
        promoId,
        nextCode,
        nextBenefitType,
        JSON.stringify(nextBenefit),
        nextMaxRedemptions === null ? null : asCount(nextMaxRedemptions),
        nextPerUserLimit,
        nextStartsAt ?? null,
        nextExpiresAt ?? null,
        nextIsActive
      ]
    );

    await client.query('COMMIT');
    return res.json(mapPromoCodeRow(updateResult.rows[0]));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // noop
    }
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const pgCode = String(error?.code || '');
    if (pgCode === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'PROMO_CODE_CONFLICT',
        message: 'Promo code already exists',
        requestId: req.requestId
      });
    }
    const code = promoSchemaUnavailableStatus(error) ? 'PROMO_SCHEMA_NOT_READY' : 'PROMO_CODES_WRITE_FAILED';
    const message = promoSchemaUnavailableStatus(error)
      ? 'Promo schema is not ready'
      : 'Failed to update promo code';
    logError({
      type: 'admin_promo_codes_update_failed',
      requestId: req.requestId,
      promoId,
      error: error?.message || 'unknown'
    });
    const statusCode = code === 'PROMO_SCHEMA_NOT_READY' ? 503 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  } finally {
    client.release();
  }
});

app.delete('/admin/promo-codes/:id', requireAdminAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

  const promoId = String(req.params.id || '').trim();
  if (!promoId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_PROMO_ID',
      message: 'Missing promo code id',
      requestId: req.requestId
    });
  }

  const client = await promoStorage.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${PROMO_QUERY_TIMEOUT_MS}`);
    const promoResult = await client.query(
      `
        SELECT id, code
        FROM promo_codes
        WHERE id = $1
        FOR UPDATE
      `,
      [promoId]
    );
    if (promoResult.rowCount <= 0) {
      throw new PromoApiError(404, 'PROMO_NOT_FOUND', 'Promo code not found');
    }

    const redemptionCountResult = await client.query(
      `
        SELECT count(*)::int AS count
        FROM promo_redemptions
        WHERE promo_code_id = $1
      `,
      [promoId]
    );
    const redemptions = asCount(redemptionCountResult.rows[0]?.count);
    if (redemptions > 0) {
      throw new PromoApiError(409, 'PROMO_CODE_IN_USE', 'Promo code has redemptions and cannot be deleted');
    }

    await client.query('DELETE FROM promo_codes WHERE id = $1', [promoId]);
    await client.query('COMMIT');
    return res.json({
      ok: true,
      id: promoId,
      code: String(promoResult.rows[0]?.code || '').trim() || null
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // noop
    }
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const code = promoSchemaUnavailableStatus(error) ? 'PROMO_SCHEMA_NOT_READY' : 'PROMO_CODES_WRITE_FAILED';
    const message = promoSchemaUnavailableStatus(error)
      ? 'Promo schema is not ready'
      : 'Failed to delete promo code';
    logError({
      type: 'admin_promo_codes_delete_failed',
      requestId: req.requestId,
      promoId,
      error: error?.message || 'unknown'
    });
    const statusCode = code === 'PROMO_SCHEMA_NOT_READY' ? 503 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  } finally {
    client.release();
  }
});

app.get('/admin/posts', requireAdminAuth, (req, res) => {
  try {
    return res.json(listAdminPosts());
  } catch (error) {
    logError({
      type: 'admin_posts_list_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POSTS_READ_FAILED',
      message: 'Failed to load posts',
      requestId: req.requestId
    });
  }
});

app.post('/admin/posts', requireAdminAuth, (req, res) => {
  try {
    const body = asObject(req.body);
    const title = String(body.title || '').trim();
    const contentMd = String(body.content_md || '').trim();
    const requestedSlug = Object.prototype.hasOwnProperty.call(body, 'slug')
      ? String(body.slug || '')
      : title;
    const status = normalizeAdminPostStatus(body.status, 'draft');

    if (!title) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_TITLE',
        message: 'Post title is required',
        requestId: req.requestId
      });
    }
    if (title.length > ADMIN_POST_TITLE_MAX_LEN) {
      return res.status(400).json({
        status: 'error',
        code: 'TITLE_TOO_LONG',
        message: `Title exceeds ${ADMIN_POST_TITLE_MAX_LEN} characters`,
        requestId: req.requestId
      });
    }
    if (!contentMd) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CONTENT',
        message: 'Post content is required',
        requestId: req.requestId
      });
    }
    if (contentMd.length > ADMIN_POST_CONTENT_MAX_LEN) {
      return res.status(400).json({
        status: 'error',
        code: 'CONTENT_TOO_LONG',
        message: `Content exceeds ${ADMIN_POST_CONTENT_MAX_LEN} characters`,
        requestId: req.requestId
      });
    }
    if (!status) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_STATUS',
        message: 'Status must be one of draft, published, archived',
        requestId: req.requestId
      });
    }

    const slugBase = slugifyPostValue(requestedSlug);
    if (!slugBase) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_SLUG',
        message: 'Slug must include letters or numbers',
        requestId: req.requestId
      });
    }

    const posts = loadAdminPostsStore().slice();
    const nowIso = new Date().toISOString();
    const post = {
      id: uuidv4(),
      slug: getUniqueAdminPostSlug(posts, slugBase),
      title,
      excerpt: buildAdminPostExcerpt(contentMd, body.excerpt || ''),
      content_md: contentMd,
      status,
      likes_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
      published_at: status === 'published' ? nowIso : null
    };

    posts.push(post);
    saveAdminPostsStore(posts);
    return res.status(201).json(post);
  } catch (error) {
    logError({
      type: 'admin_posts_create_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POSTS_WRITE_FAILED',
      message: 'Failed to create post',
      requestId: req.requestId
    });
  }
});

app.patch('/admin/posts/:id', requireAdminAuth, (req, res) => {
  try {
    const postId = String(req.params.id || '').trim();
    if (!postId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_POST_ID',
        message: 'Missing post id',
        requestId: req.requestId
      });
    }
    const body = asObject(req.body);
    const posts = loadAdminPostsStore().slice();
    const index = posts.findIndex((item) => item.id === postId);
    if (index < 0) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }

    const current = posts[index];
    const next = { ...current };
    const nowIso = new Date().toISOString();

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title || '').trim();
      if (!title) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_TITLE',
          message: 'Post title is required',
          requestId: req.requestId
        });
      }
      if (title.length > ADMIN_POST_TITLE_MAX_LEN) {
        return res.status(400).json({
          status: 'error',
          code: 'TITLE_TOO_LONG',
          message: `Title exceeds ${ADMIN_POST_TITLE_MAX_LEN} characters`,
          requestId: req.requestId
        });
      }
      next.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'content_md')) {
      const contentMd = String(body.content_md || '').trim();
      if (!contentMd) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_CONTENT',
          message: 'Post content is required',
          requestId: req.requestId
        });
      }
      if (contentMd.length > ADMIN_POST_CONTENT_MAX_LEN) {
        return res.status(400).json({
          status: 'error',
          code: 'CONTENT_TOO_LONG',
          message: `Content exceeds ${ADMIN_POST_CONTENT_MAX_LEN} characters`,
          requestId: req.requestId
        });
      }
      next.content_md = contentMd;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
      const slugBase = slugifyPostValue(body.slug);
      if (!slugBase) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_SLUG',
          message: 'Slug must include letters or numbers',
          requestId: req.requestId
        });
      }
      next.slug = getUniqueAdminPostSlug(posts, slugBase, postId);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = normalizeAdminPostStatus(body.status, null);
      if (!status) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_STATUS',
          message: 'Status must be one of draft, published, archived',
          requestId: req.requestId
        });
      }
      next.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'excerpt')) {
      next.excerpt = buildAdminPostExcerpt(next.content_md, body.excerpt || '');
    } else if (Object.prototype.hasOwnProperty.call(body, 'content_md')) {
      next.excerpt = buildAdminPostExcerpt(next.content_md, next.excerpt || '');
    }

    if (next.status === 'published') {
      next.published_at = current.published_at || nowIso;
    } else {
      next.published_at = null;
    }
    next.updated_at = nowIso;

    posts[index] = next;
    saveAdminPostsStore(posts);
    return res.json(next);
  } catch (error) {
    logError({
      type: 'admin_posts_update_failed',
      requestId: req.requestId,
      postId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POSTS_WRITE_FAILED',
      message: 'Failed to update post',
      requestId: req.requestId
    });
  }
});

app.delete('/admin/posts/:id', requireAdminAuth, async (req, res) => {
  try {
    const postId = String(req.params.id || '').trim();
    if (!postId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_POST_ID',
        message: 'Missing post id',
        requestId: req.requestId
      });
    }
    const posts = loadAdminPostsStore().slice();
    const index = posts.findIndex((item) => item.id === postId);
    if (index < 0) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }
    const removed = posts.splice(index, 1)[0];
    saveAdminPostsStore(posts);
    await withPostLikesLock(() => {
      const likes = loadPostLikesStore().filter((like) => like.post_id !== removed.id);
      savePostLikesStore(likes);
    });
    return res.json({ ok: true, id: removed.id });
  } catch (error) {
    logError({
      type: 'admin_posts_delete_failed',
      requestId: req.requestId,
      postId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POSTS_WRITE_FAILED',
      message: 'Failed to delete post',
      requestId: req.requestId
    });
  }
});

app.get('/posts', (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const posts = listAdminPosts().filter((post) => post.status === 'published');
    const likes = loadPostLikesStore();
    const likesCountMap = buildPostLikesCountMap(likes);
    const likedPostSet = new Set(
      userId
        ? likes
          .filter((like) => like.user_id === userId)
          .map((like) => like.post_id)
        : []
    );
    const rows = posts
      .map((post) => buildPublicPostSummary(post, {
        likesCount: Number(likesCountMap.get(post.id) || 0),
        liked: likedPostSet.has(post.id)
      }))
      .sort((left, right) => {
        const rightTs = Date.parse(right.published_at || right.updated_at || right.created_at || '') || 0;
        const leftTs = Date.parse(left.published_at || left.updated_at || left.created_at || '') || 0;
        return rightTs - leftTs;
      });
    return res.json(rows);
  } catch (error) {
    logError({
      type: 'posts_list_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POSTS_READ_FAILED',
      message: 'Failed to load posts',
      requestId: req.requestId
    });
  }
});

app.get('/posts/:id/likes', (req, res) => {
  try {
    const postId = String(req.params.id || '').trim();
    const userId = getRequestUserId(req);
    if (!postId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_POST_ID',
        message: 'Missing post id',
        requestId: req.requestId
      });
    }
    const post = listAdminPosts().find((item) => item.id === postId && item.status === 'published');
    if (!post) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }
    const likes = loadPostLikesStore();
    const likesCountMap = buildPostLikesCountMap(likes);
    const likesCount = Number(likesCountMap.get(post.id) || 0);
    const liked = Boolean(userId && likes.some((like) => like.post_id === post.id && like.user_id === userId));
    return res.json({
      post_id: post.id,
      likes_count: likesCount,
      liked
    });
  } catch (error) {
    logError({
      type: 'post_likes_read_failed',
      requestId: req.requestId,
      postId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POST_LIKES_READ_FAILED',
      message: 'Failed to load likes',
      requestId: req.requestId
    });
  }
});

app.post('/posts/:id/like', requireUserAuth, async (req, res) => {
  try {
    const postId = String(req.params.id || '').trim();
    if (!postId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_POST_ID',
        message: 'Missing post id',
        requestId: req.requestId
      });
    }

    try {
      const redis = await ensureRedisAvailable(req.requestId);
      if (redis.ok) {
        const allowed = await rateLimit(`rl:post_like:${req.user.id}`, POST_LIKE_RATE_LIMIT_PER_MIN, 60);
        if (!allowed) {
          return res.status(429).json({
            status: 'error',
            code: 'RATE_LIMIT',
            message: 'Too many like actions',
            requestId: req.requestId
          });
        }
      } else {
        logError({
          type: 'post_like_rate_limit_skipped',
          requestId: req.requestId,
          details: redis.payload?.details || 'redis_unavailable'
        });
      }
    } catch (rateLimitError) {
      logError({
        type: 'post_like_rate_limit_error',
        requestId: req.requestId,
        error: rateLimitError?.message || 'unknown'
      });
    }

    const post = listAdminPosts().find((item) => item.id === postId && item.status === 'published');
    if (!post) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }

    const mutation = await withPostLikesLock(() => {
      const likes = loadPostLikesStore().slice();
      const withoutCurrent = likes.filter((like) => !(like.post_id === postId && like.user_id === req.user.id));
      const hadLike = withoutCurrent.length !== likes.length;
      const liked = !hadLike;
      if (liked) {
        withoutCurrent.push({
          id: uuidv4(),
          post_id: postId,
          user_id: req.user.id,
          created_at: new Date().toISOString()
        });
      }

      savePostLikesStore(withoutCurrent);
      const likesCountMap = buildPostLikesCountMap(withoutCurrent);
      const likesCount = Number(likesCountMap.get(postId) || 0);
      const posts = loadAdminPostsStore().slice();
      const postIndex = posts.findIndex((item) => item.id === postId);
      if (postIndex >= 0) {
        posts[postIndex] = {
          ...posts[postIndex],
          likes_count: likesCount
        };
        saveAdminPostsStore(posts);
      }
      return { liked, likesCount };
    });

    return res.json({
      post_id: postId,
      liked: mutation.liked,
      likes_count: mutation.likesCount
    });
  } catch (error) {
    logError({
      type: 'post_like_toggle_failed',
      requestId: req.requestId,
      postId: req.params?.id || null,
      userId: req.user?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POST_LIKE_TOGGLE_FAILED',
      message: 'Failed to toggle like',
      requestId: req.requestId
    });
  }
});

app.get('/posts/:slug', (req, res) => {
  try {
    const slug = slugifyPostValue(req.params.slug);
    const userId = getRequestUserId(req);
    if (!slug) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }

    const post = listAdminPosts().find((item) => item.slug === slug && item.status === 'published');
    if (!post) {
      return res.status(404).json({
        status: 'error',
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        requestId: req.requestId
      });
    }

    const likes = loadPostLikesStore();
    const likesCountMap = buildPostLikesCountMap(likes);
    const likesCount = Number(likesCountMap.get(post.id) || 0);
    const liked = Boolean(userId && likes.some((like) => like.post_id === post.id && like.user_id === userId));

    return res.json({
      ...buildPublicPostSummary(post, { likesCount, liked }),
      content_md: post.content_md
    });
  } catch (error) {
    logError({
      type: 'post_read_failed',
      requestId: req.requestId,
      slug: req.params?.slug || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'POST_READ_FAILED',
      message: 'Failed to load post',
      requestId: req.requestId
    });
  }
});

app.get('/account/profile', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const result = await storage.pool.query(
      `
        SELECT user_id, display_name, timezone, avatar_url, updated_at
        FROM account_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );
    return res.json(mapAccountProfileRow(result.rows[0] || null, userId));
  } catch (error) {
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_PROFILE_READ_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to load account profile';
    logError({
      type: 'account_profile_read_failed',
      requestId: req.requestId,
      userId: userId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.patch('/account/profile', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const body = asObject(req.body);
    const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'display_name');
    const hasTimezone = Object.prototype.hasOwnProperty.call(body, 'timezone');
    const hasAvatarUrl = Object.prototype.hasOwnProperty.call(body, 'avatar_url');
    if (!hasDisplayName && !hasTimezone && !hasAvatarUrl) {
      return res.status(400).json({
        status: 'error',
        code: 'EMPTY_PATCH',
        message: 'No fields to update',
        requestId: req.requestId
      });
    }

    const current = await storage.pool.query(
      `
        SELECT display_name, timezone, avatar_url
        FROM account_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );
    const currentRow = current.rows[0] || {};

    const parseOptionalField = (raw, field, maxLen) => {
      if (raw === undefined) return undefined;
      if (raw === null || raw === '') return null;
      if (typeof raw !== 'string') {
        throw new PromoApiError(400, 'INVALID_ACCOUNT_FIELD', `${field} must be string`);
      }
      return toCleanText(raw, maxLen) || null;
    };

    const nextDisplayName = hasDisplayName
      ? parseOptionalField(body.display_name, 'display_name', ACCOUNT_PROFILE_NAME_MAX_LEN)
      : (toCleanText(currentRow.display_name || '', ACCOUNT_PROFILE_NAME_MAX_LEN) || null);
    const nextTimezone = hasTimezone
      ? parseOptionalField(body.timezone, 'timezone', ACCOUNT_PROFILE_TZ_MAX_LEN)
      : (toCleanText(currentRow.timezone || '', ACCOUNT_PROFILE_TZ_MAX_LEN) || null);
    const nextAvatarUrl = hasAvatarUrl
      ? parseOptionalField(body.avatar_url, 'avatar_url', ACCOUNT_PROFILE_AVATAR_MAX_LEN)
      : (toCleanText(currentRow.avatar_url || '', ACCOUNT_PROFILE_AVATAR_MAX_LEN) || null);

    const result = await storage.pool.query(
      `
        INSERT INTO account_profiles (
          user_id,
          display_name,
          timezone,
          avatar_url,
          updated_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          timezone = EXCLUDED.timezone,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
        RETURNING user_id, display_name, timezone, avatar_url, updated_at
      `,
      [userId, nextDisplayName, nextTimezone, nextAvatarUrl]
    );

    log({
      type: 'account_profile_update',
      requestId: req.requestId,
      userId
    });
    return res.json(mapAccountProfileRow(result.rows[0] || null, userId));
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_PROFILE_WRITE_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to update account profile';
    logError({
      type: 'account_profile_update_failed',
      requestId: req.requestId,
      userId: userId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.get('/account/connections', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const result = await storage.pool.query(
      `
        SELECT id, provider, provider_user_id, email, linked_at
        FROM user_connections
        WHERE user_id = $1
        ORDER BY linked_at DESC
      `,
      [userId]
    );
    const mapped = result.rows.map((row) => mapAccountConnectionRow(row)).filter(Boolean);
    const byProvider = new Map(mapped.map((item) => [item.provider, item]));
    const payload = Array.from(ACCOUNT_CONNECTION_PROVIDERS).map((provider) => {
      const row = byProvider.get(provider);
      if (!row) {
        return {
          provider,
          connected: false,
          email: null,
          linked_at: null
        };
      }
      return {
        provider,
        connected: true,
        email: row.email,
        linked_at: row.linked_at
      };
    });
    return res.json(payload);
  } catch (error) {
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_CONNECTIONS_READ_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to load connected accounts';
    logError({
      type: 'account_connections_read_failed',
      requestId: req.requestId,
      userId: userId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.post('/account/connections/:provider/link', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  const provider = normalizeAccountProvider(req.params.provider);
  if (!provider) {
    return res.status(400).json({
      status: 'error',
      code: 'UNSUPPORTED_PROVIDER',
      message: 'Provider is not supported',
      requestId: req.requestId
    });
  }

  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const body = asObject(req.body);
    const providerUserId = normalizeAccountProviderUserId(
      body.provider_user_id || body.providerUserId || body.uid || ''
    );
    if (!providerUserId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PROVIDER_USER_ID',
        message: 'provider_user_id is required',
        requestId: req.requestId
      });
    }
    const providerEmail = normalizeAccountConnectionEmail(body.email || body.provider_email || body.providerEmail);

    const existingResult = await storage.pool.query(
      `
        SELECT id, provider, provider_user_id, email, linked_at
        FROM user_connections
        WHERE user_id = $1
          AND provider = $2
        LIMIT 1
      `,
      [userId, provider]
    );
    const existing = mapAccountConnectionRow(existingResult.rows[0] || null);
    if (
      existing
      && String(existing.provider_user_id || '') === providerUserId
      && String(existing.email || '') === String(providerEmail || '')
    ) {
      return res.json({
        status: 'already_linked',
        connection: {
          provider,
          connected: true,
          email: existing.email,
          linked_at: existing.linked_at
        }
      });
    }

    const upsertResult = await storage.pool.query(
      `
        INSERT INTO user_connections (
          id,
          user_id,
          provider,
          provider_user_id,
          email,
          linked_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          provider_user_id = EXCLUDED.provider_user_id,
          email = EXCLUDED.email,
          linked_at = now()
        RETURNING id, provider, provider_user_id, email, linked_at
      `,
      [userId, provider, providerUserId, providerEmail]
    );
    const connection = mapAccountConnectionRow(upsertResult.rows[0] || null);
    log({
      type: 'account_provider_link',
      requestId: req.requestId,
      userId,
      provider
    });
    return res.json({
      status: existing ? 'linked' : 'linked',
      connection: {
        provider,
        connected: true,
        email: connection?.email || null,
        linked_at: connection?.linked_at || null
      }
    });
  } catch (error) {
    const pgCode = String(error?.code || '');
    if (pgCode === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'PROVIDER_ALREADY_LINKED',
        message: 'Provider account is already linked to another user',
        requestId: req.requestId
      });
    }
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_CONNECTIONS_WRITE_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to link provider';
    logError({
      type: 'account_connections_link_failed',
      requestId: req.requestId,
      userId: userId || null,
      provider: provider || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.delete('/account/connections/:provider', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  const provider = normalizeAccountProvider(req.params.provider);
  if (!provider) {
    return res.status(400).json({
      status: 'error',
      code: 'UNSUPPORTED_PROVIDER',
      message: 'Provider is not supported',
      requestId: req.requestId
    });
  }

  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const existingResult = await storage.pool.query(
      `
        SELECT id
        FROM user_connections
        WHERE user_id = $1
          AND provider = $2
        LIMIT 1
      `,
      [userId, provider]
    );
    if (existingResult.rowCount <= 0) {
      return res.json({
        status: 'disconnected',
        provider,
        already_disconnected: true
      });
    }

    const totalResult = await storage.pool.query(
      `
        SELECT count(*)::int AS count
        FROM user_connections
        WHERE user_id = $1
      `,
      [userId]
    );
    const totalConnections = asCount(totalResult.rows[0]?.count);
    if (totalConnections <= 1) {
      return res.status(400).json({
        status: 'error',
        code: 'CANNOT_REMOVE_LAST_LOGIN_METHOD',
        message: 'Cannot remove the last login method',
        requestId: req.requestId
      });
    }

    await storage.pool.query(
      `
        DELETE FROM user_connections
        WHERE user_id = $1
          AND provider = $2
      `,
      [userId, provider]
    );
    log({
      type: 'account_provider_unlink',
      requestId: req.requestId,
      userId,
      provider
    });
    return res.json({
      status: 'disconnected',
      provider
    });
  } catch (error) {
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_CONNECTIONS_WRITE_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to disconnect provider';
    logError({
      type: 'account_connections_unlink_failed',
      requestId: req.requestId,
      userId: userId || null,
      provider: provider || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.post('/account/telegram/link-code', requireUserAuth, async (req, res) => {
  if (!BOT_INTERNAL_API_BASE || !BOT_INTERNAL_LINK_SECRET) {
    return res.status(503).json({
      status: 'error',
      code: 'TELEGRAM_LINK_NOT_CONFIGURED',
      message: 'Telegram link service is not configured',
      requestId: req.requestId
    });
  }

  const userId = String(req.user?.id || '').trim();
  const body = asObject(req.body);
  const email = normalizeAccountConnectionEmail(body.email || body.user_email || body.userEmail || '');
  const requestedTtlSec = toPositiveInt(body.ttl_sec || body.ttlSec, ACCOUNT_TELEGRAM_CODE_TTL_SEC);
  const ttlSec = Math.min(3600, Math.max(60, requestedTtlSec));
  const code = generateAccountTelegramCode();

  const accountStorage = getAccountStorageStatus();
  if (accountStorage.ok) {
    try {
      await touchAccountSession({ pool: accountStorage.pool, req, userId });
    } catch (error) {
      logError({
        type: 'account_telegram_touch_session_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACCOUNT_TELEGRAM_INTERNAL_TIMEOUT_MS);
  try {
    const response = await fetch(`${BOT_INTERNAL_API_BASE}/internal/link/code/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-link-secret': BOT_INTERNAL_LINK_SECRET
      },
      body: JSON.stringify({
        code,
        app_user_id: userId,
        email: email || null,
        ttl_sec: ttlSec
      }),
      signal: controller.signal
    });
    const payload = await safeJson(response);
    if (!response.ok || !payload || payload.ok !== true) {
      logError({
        type: 'account_telegram_register_failed',
        requestId: req.requestId,
        userId: userId || null,
        status: response.status,
        code: payload?.code || null,
        message: payload?.message || null
      });
      return res.status(502).json({
        status: 'error',
        code: 'TELEGRAM_LINK_REGISTER_FAILED',
        message: payload?.message || 'Failed to register Telegram link code',
        requestId: req.requestId
      });
    }

    log({
      type: 'account_telegram_link_code_created',
      requestId: req.requestId,
      userId,
      ttlSec
    });
    return res.json({
      ok: true,
      code: String(payload.code || code).trim().toUpperCase(),
      expires_at: payload.expires_at || new Date(Date.now() + (ttlSec * 1000)).toISOString(),
      ttl_sec: ttlSec
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      status: 'error',
      code: timedOut ? 'TELEGRAM_LINK_TIMEOUT' : 'TELEGRAM_LINK_CREATE_FAILED',
      message: timedOut ? 'Telegram link service timeout' : 'Failed to create Telegram link code',
      requestId: req.requestId
    });
  } finally {
    clearTimeout(timeout);
  }
});
app.get('/account/sessions', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  try {
    const currentSession = await touchAccountSession({ pool: storage.pool, req, userId });
    const currentHash = String(currentSession?.current_hash || '').trim();
    const sessionsResult = await storage.pool.query(
      `
        SELECT
          id,
          user_id,
          session_token_hash,
          user_agent,
          ip_address,
          created_at,
          last_active_at,
          expires_at,
          revoked_at
        FROM user_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        ORDER BY last_active_at DESC
        LIMIT $2
      `,
      [userId, ACCOUNT_SESSIONS_LIST_LIMIT]
    );
    return res.json(sessionsResult.rows.map((row) => mapAccountSessionRow(row, currentHash)).filter(Boolean));
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_SESSIONS_READ_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to load sessions';
    logError({
      type: 'account_sessions_read_failed',
      requestId: req.requestId,
      userId: userId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.delete('/account/sessions/:id', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  const sessionId = String(req.params.id || '').trim();
  if (!sessionId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_SESSION_ID',
      message: 'Session id is required',
      requestId: req.requestId
    });
  }
  try {
    const currentSession = await touchAccountSession({ pool: storage.pool, req, userId });
    const currentHash = String(currentSession?.current_hash || '').trim();
    const targetResult = await storage.pool.query(
      `
        SELECT id, session_token_hash
        FROM user_sessions
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [sessionId, userId]
    );
    if (targetResult.rowCount <= 0) {
      return res.status(404).json({
        status: 'error',
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        requestId: req.requestId
      });
    }
    await storage.pool.query(
      `
        UPDATE user_sessions
        SET revoked_at = now()
        WHERE id = $1
          AND user_id = $2
      `,
      [sessionId, userId]
    );
    const targetHash = String(targetResult.rows[0]?.session_token_hash || '').trim();
    const isCurrent = Boolean(currentHash && targetHash && currentHash === targetHash);
    log({
      type: 'account_session_revoked',
      requestId: req.requestId,
      userId,
      sessionId,
      current: isCurrent
    });
    return res.json({
      ok: true,
      id: sessionId,
      current: isCurrent
    });
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_SESSIONS_WRITE_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to revoke session';
    logError({
      type: 'account_session_revoke_failed',
      requestId: req.requestId,
      userId: userId || null,
      sessionId: sessionId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.post('/account/sessions/logout-all', requireUserAuth, async (req, res) => {
  const storage = getAccountStorageStatus();
  if (!storage.ok) {
    return res.status(storage.statusCode).json({
      status: 'error',
      code: storage.code,
      message: storage.message,
      requestId: req.requestId
    });
  }
  const userId = String(req.user?.id || '').trim();
  try {
    await touchAccountSession({ pool: storage.pool, req, userId });
    const result = await storage.pool.query(
      `
        UPDATE user_sessions
        SET revoked_at = now()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [userId]
    );
    log({
      type: 'account_logout_all',
      requestId: req.requestId,
      userId,
      revoked: result.rowCount || 0
    });
    return res.json({
      ok: true,
      revoked_count: Number(result.rowCount || 0)
    });
  } catch (error) {
    if (error instanceof PromoApiError) {
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'ACCOUNT_SCHEMA_NOT_READY' : 'ACCOUNT_SESSIONS_WRITE_FAILED';
    const message = schemaUnavailable ? 'Account schema is not ready' : 'Failed to logout all sessions';
    logError({
      type: 'account_logout_all_failed',
      requestId: req.requestId,
      userId: userId || null,
      error: error?.message || 'unknown'
    });
    return res.status(schemaUnavailable ? 503 : 500).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.get('/account/billing', requireUserAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

  const rawUserId = String(req.user?.id || '').trim();
  const promoUserId = normalizePromoUserId(rawUserId);
  if (!promoUserId) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_USER_ID',
      message: 'User id is invalid',
      requestId: req.requestId
    });
  }

  try {
    await touchAccountSession({ pool: promoStorage.pool, req, userId: rawUserId });
    const [activeBenefitsResult, historyResult] = await Promise.all([
      promoStorage.pool.query(
        `
          SELECT
            id,
            kind,
            scope,
            payload,
            starts_at,
            ends_at,
            revoked_at
          FROM user_entitlements
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND (ends_at IS NULL OR ends_at > now())
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [promoUserId]
      ),
      promoStorage.pool.query(
        `
          SELECT
            r.id AS redemption_id,
            r.created_at AS redeemed_at,
            r.benefit_snapshot,
            p.code,
            p.benefit_type,
            e.id AS entitlement_id,
            e.kind AS entitlement_kind,
            e.scope AS entitlement_scope,
            e.payload AS entitlement_payload,
            e.starts_at AS entitlement_starts_at,
            e.ends_at AS entitlement_ends_at,
            e.revoked_at AS entitlement_revoked_at
          FROM promo_redemptions r
          JOIN promo_codes p
            ON p.id = r.promo_code_id
          LEFT JOIN LATERAL (
            SELECT
              id,
              kind,
              scope,
              payload,
              starts_at,
              ends_at,
              revoked_at
            FROM user_entitlements
            WHERE source_type = 'promo_code'
              AND source_id = r.id
            ORDER BY created_at DESC
            LIMIT 1
          ) e ON true
          WHERE r.user_id = $1
          ORDER BY r.created_at DESC
          LIMIT 100
        `,
        [promoUserId]
      )
    ]);

    const activeBenefits = activeBenefitsResult.rows
      .map((row) => mapEntitlementRow(row))
      .filter(Boolean)
      .map((benefit) => ({ ...benefit, is_active: true }));
    const promoHistory = historyResult.rows.map((row) => mapPromoHistoryRow(row)).filter(Boolean);
    const plan = resolveBillingPlanSummary(activeBenefits);

    return res.json({
      user_id: rawUserId,
      promo_user_id: promoUserId,
      plan,
      active_benefits: activeBenefits,
      promo_history: promoHistory,
      totals: {
        active_benefits: activeBenefits.length,
        redemptions: promoHistory.length
      }
    });
  } catch (error) {
    const schemaUnavailable = promoSchemaUnavailableStatus(error);
    const code = schemaUnavailable ? 'PROMO_SCHEMA_NOT_READY' : 'ACCOUNT_BILLING_READ_FAILED';
    const message = schemaUnavailable
      ? 'Promo schema is not ready'
      : 'Failed to load account billing data';
    const statusCode = schemaUnavailable ? 503 : 500;
    logError({
      type: 'account_billing_read_failed',
      requestId: req.requestId,
      userId: rawUserId || null,
      promoUserId,
      error: error?.message || 'unknown'
    });
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});

app.post('/promo/redeem', requireUserAuth, async (req, res) => {
  const rawUserId = String(req.user?.id || '').trim();
  const promoUserId = normalizePromoUserId(rawUserId);
  try {
    const body = asObject(req.body);
    const code = normalizePromoCode(body.code);
    const idempotencyKey = normalizeIdempotencyKey(req, body);

    if (!code) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CODE',
        message: 'Promo code is required',
        requestId: req.requestId
      });
    }
    if (code.length > PROMO_CODE_MAX_LEN) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_CODE',
        message: `Promo code exceeds ${PROMO_CODE_MAX_LEN} characters`,
        requestId: req.requestId
      });
    }
    if (idempotencyKey && idempotencyKey.length > PROMO_IDEMPOTENCY_KEY_MAX_LEN) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: `Idempotency key exceeds ${PROMO_IDEMPOTENCY_KEY_MAX_LEN} characters`,
        requestId: req.requestId
      });
    }
    if (!promoUserId) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_USER_ID',
        message: 'User id is invalid',
        requestId: req.requestId
      });
    }

    const result = await redeemPromoCodeTransaction({
      userId: promoUserId,
      code,
      idempotencyKey
    });
    log({
      type: 'promo_redeem_success',
      requestId: req.requestId,
      userId: rawUserId || null,
      promoUserId,
      code,
      status: result.status,
      redemptionId: result.redemption_id || null
    });
    return res.json(result);
  } catch (error) {
    const isKnownPromoError = error instanceof PromoApiError;
    const pgCode = String(error?.code || '');
    if (isKnownPromoError) {
      logError({
        type: 'promo_redeem_rejected',
        requestId: req.requestId,
        userId: rawUserId || null,
        promoUserId: promoUserId || null,
        reason: error.code,
        message: error.message
      });
      return res.status(error.statusCode).json({
        status: 'error',
        code: error.code,
        message: error.message,
        requestId: req.requestId
      });
    }
    if (pgCode === '42P01' || pgCode === '3D000') {
      logError({
        type: 'promo_redeem_schema_not_ready',
        requestId: req.requestId,
        userId: rawUserId || null,
        promoUserId: promoUserId || null,
        error: error?.message || 'unknown'
      });
      return res.status(503).json({
        status: 'error',
        code: 'PROMO_SCHEMA_NOT_READY',
        message: 'Promo schema is not ready',
        requestId: req.requestId
      });
    }
    if (pgCode === '23505') {
      logError({
        type: 'promo_redeem_conflict',
        requestId: req.requestId,
        userId: rawUserId || null,
        promoUserId: promoUserId || null,
        error: error?.message || 'unknown'
      });
      return res.status(409).json({
        status: 'error',
        code: 'PROMO_REDEEM_CONFLICT',
        message: 'Promo redeem conflict detected',
        requestId: req.requestId
      });
    }
    if (
      String(error?.message || '').toLowerCase().includes('cannot find module')
      && String(error?.message || '').includes("'pg'")
    ) {
      logError({
        type: 'promo_redeem_pg_missing',
        requestId: req.requestId,
        error: error?.message || 'unknown'
      });
      return res.status(503).json({
        status: 'error',
        code: 'PROMO_STORAGE_UNAVAILABLE',
        message: 'Promo storage dependency is missing',
        requestId: req.requestId
      });
    }
    logError({
      type: 'promo_redeem_failed',
      requestId: req.requestId,
      userId: rawUserId || null,
      promoUserId: promoUserId || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'PROMO_REDEEM_FAILED',
      message: 'Failed to redeem promo code',
      requestId: req.requestId
    });
  }
});

app.get('/admin/metrics/overview', requireAdminAuth, async (req, res) => {
  const clickhouseEnabled = isClickHouseAnalyticsEnabled();
  const fallbackEnabled = canUseAnalyticsFallback();
  if (!clickhouseEnabled && !fallbackEnabled) {
    return res.status(503).json(analyticsUnavailablePayload(req.requestId));
  }

  try {
    if (clickhouseEnabled) {
      const [
        onlineRows,
        eventsRows,
        searchesRows,
        topToolsRows,
        summaryRows,
        conversionRows,
        redirectRows,
        latencyRows,
        hourlyRows
      ] = await Promise.all([
        queryClickHouse(`
          SELECT count(DISTINCT session_id) AS online_now
          FROM analytics_events
          PREWHERE event_time >= now() - INTERVAL 5 MINUTE
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT count() AS events_per_min
          FROM analytics_events
          PREWHERE event_time >= now() - INTERVAL 1 MINUTE
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT count() AS searches_today
          FROM analytics_events
          PREWHERE event_time >= toStartOfDay(now())
          WHERE event_name = 'search_submit'
            AND ingestion_source != 'legacy_expand'
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT tool_id, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= toStartOfDay(now())
          WHERE event_name = 'tool_open'
            AND tool_id IS NOT NULL
            AND tool_id != ''
          GROUP BY tool_id
          ORDER BY cnt DESC
          LIMIT 5
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            uniqExact(session_id) AS total_sessions,
            uniqExactIf(session_id, event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS search_sessions,
            countIf(event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS submit_events,
            countIf(event_name = 'search_parsed' AND ingestion_source != 'legacy_expand' AND parse_success = 1) AS parsed_success_events,
            countIf(event_name = 'search_results' AND ingestion_source != 'legacy_expand') AS results_events,
            countIf(event_name = 'search_results' AND ingestion_source != 'legacy_expand' AND matches_count = 0) AS zero_results_events,
            countIf(event_name = 'search_redirect' AND ingestion_source != 'legacy_expand') AS redirects_events,
            countIf(event_name = 'tool_open' AND source = 'search') AS tool_open_from_search_events
          FROM analytics_events
          PREWHERE event_time >= toStartOfDay(now())
          FORMAT JSON
        `),
        queryClickHouse(`
          WITH toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
          SELECT
            count() AS search_sessions,
            countIf(converted = 1) AS converted_sessions,
            quantileExactIf(0.5)(seconds_to_open, converted = 1) AS p50_time_to_tool_sec,
            quantileExactIf(0.95)(seconds_to_open, converted = 1) AS p95_time_to_tool_sec
          FROM
          (
            SELECT
              session_id,
              minIf(event_time, event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS first_submit_at,
              minIf(event_time, event_name = 'tool_open' AND source = 'search') AS first_tool_open_at,
              dateDiff('second', first_submit_at, first_tool_open_at) AS seconds_to_open,
              toUInt8(
                first_submit_at > epoch
                AND first_tool_open_at > epoch
                AND first_tool_open_at >= first_submit_at
                AND first_tool_open_at <= first_submit_at + toIntervalMinute(30)
              ) AS converted
            FROM analytics_events
            WHERE event_time >= toStartOfDay(now())
              AND event_name IN ('search_submit', 'tool_open')
            GROUP BY session_id
            HAVING first_submit_at > epoch
          )
          FORMAT JSON
        `),
        queryClickHouse(`
          WITH toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
          SELECT
            count() AS redirects,
            countIf(no_back_navigation = 1) AS successful_redirects
          FROM
          (
            SELECT
              r.session_id,
              r.event_time AS redirect_at,
              min(s.event_time) AS next_submit_at,
              toUInt8(
                next_submit_at = epoch
                OR next_submit_at > redirect_at + toIntervalSecond(30)
              ) AS no_back_navigation
            FROM
            (
              SELECT session_id, event_time
              FROM analytics_events
              WHERE event_time >= toStartOfDay(now())
                AND event_name = 'search_redirect'
                AND ingestion_source != 'legacy_expand'
            ) AS r
            LEFT JOIN
            (
              SELECT session_id, event_time
              FROM analytics_events
              WHERE event_time >= toStartOfDay(now())
                AND event_name = 'search_submit'
                AND ingestion_source != 'legacy_expand'
            ) AS s
              ON s.session_id = r.session_id
              AND s.event_time > r.event_time
              AND s.event_time <= r.event_time + toIntervalMinute(10)
            GROUP BY r.session_id, redirect_at
          )
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            quantileExact(0.5)(latency_ms) AS p50_latency_ms,
            quantileExact(0.95)(latency_ms) AS p95_latency_ms
          FROM analytics_events
          PREWHERE event_time >= toStartOfDay(now())
          WHERE event_name = 'search_submit'
            AND ingestion_source != 'legacy_expand'
            AND latency_ms > 0
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            toString(toStartOfHour(event_time)) AS hour,
            count() AS events,
            countIf(event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS searches
          FROM analytics_events
          PREWHERE event_time >= now() - INTERVAL 24 HOUR
          GROUP BY toStartOfHour(event_time)
          ORDER BY toStartOfHour(event_time) ASC
          FORMAT JSON
        `)
      ]);

      const topTools = topToolsRows.map((row) => ({
        tool_id: String(row.tool_id || ''),
        count: asCount(row.cnt)
      })).filter((row) => row.tool_id);

      const summary = summaryRows[0] || {};
      const conversion = conversionRows[0] || {};
      const redirects = redirectRows[0] || {};
      const latency = latencyRows[0] || {};
      const submitEvents = asCount(summary.submit_events);
      const resultsEvents = asCount(summary.results_events);
      const redirectsEvents = asCount(summary.redirects_events);

      const hourly = hourlyRows.map((row) => ({
        hour: String(row.hour || '').trim(),
        events: asCount(row.events),
        searches: asCount(row.searches)
      })).filter((row) => row.hour);

      return res.json({
        online_now: asCount(onlineRows[0]?.online_now),
        events_per_min: asCount(eventsRows[0]?.events_per_min),
        searches_today: asCount(searchesRows[0]?.searches_today),
        top_tools: topTools,
        summary: {
          total_sessions: asCount(summary.total_sessions),
          search_sessions: asCount(summary.search_sessions),
          converted_sessions: asCount(conversion.converted_sessions),
          search_adoption_pct: ratioOrNull(summary.search_sessions, summary.total_sessions),
          parse_rate_pct: ratioOrNull(summary.parsed_success_events, submitEvents),
          zero_result_rate_pct: ratioOrNull(summary.zero_results_events, resultsEvents),
          conversion_pct: ratioOrNull(conversion.converted_sessions, conversion.search_sessions),
          redirect_share_pct: ratioOrNull(redirectsEvents, submitEvents),
          redirect_success_pct: ratioOrNull(redirects.successful_redirects, redirects.redirects),
          p50_latency_ms: asNullableNumber(latency.p50_latency_ms),
          p95_latency_ms: asNullableNumber(latency.p95_latency_ms),
          p50_time_to_tool_sec: asNullableNumber(conversion.p50_time_to_tool_sec),
          p95_time_to_tool_sec: asNullableNumber(conversion.p95_time_to_tool_sec)
        },
        funnel: {
          submit: submitEvents,
          parsed_success: asCount(summary.parsed_success_events),
          results: resultsEvents,
          zero_results: asCount(summary.zero_results_events),
          redirects: redirectsEvents,
          tool_open_from_search: asCount(summary.tool_open_from_search_events || 0)
        },
        hourly
      });
    }

    const fallbackEvents = await readAnalyticsFallbackEvents();
    const overview = buildOverviewMetricsFromEvents(fallbackEvents);
    return res.json(overview);
  } catch (error) {
    logError({
      type: 'admin_metrics_overview_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'METRICS_QUERY_FAILED',
      message: 'Failed to query overview metrics',
      requestId: req.requestId
    });
  }
});

app.get('/admin/metrics/search', requireAdminAuth, async (req, res) => {
  const clickhouseEnabled = isClickHouseAnalyticsEnabled();
  const fallbackEnabled = canUseAnalyticsFallback();
  if (!clickhouseEnabled && !fallbackEnabled) {
    return res.status(503).json(analyticsUnavailablePayload(req.requestId));
  }

  const { range, rangeStartSql, rangeDurationMs } = resolveSearchRange(req.query.range);

  try {
    if (clickhouseEnabled) {
      const [
        topQueriesRows,
        zeroQueriesRows,
        topFromRows,
        topToRows,
        topPairsRows,
        summaryRows,
        conversionRows,
        redirectRows,
        latencyRows,
        dailyRows
      ] = await Promise.all([
        queryClickHouse(`
          SELECT query_norm AS query, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_submit'
            AND ingestion_source != 'legacy_expand'
            AND query_norm != ''
          GROUP BY query
          ORDER BY cnt DESC
          LIMIT 20
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT query_norm AS query, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_results'
            AND matches_count = 0
            AND ingestion_source != 'legacy_expand'
            AND query_norm != ''
          GROUP BY query
          ORDER BY cnt DESC
          LIMIT 20
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT from_format AS format, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_parsed'
            AND ingestion_source != 'legacy_expand'
            AND from_format != ''
          GROUP BY format
          ORDER BY cnt DESC
          LIMIT 10
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT to_format AS format, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_parsed'
            AND ingestion_source != 'legacy_expand'
            AND to_format != ''
          GROUP BY format
          ORDER BY cnt DESC
          LIMIT 10
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT concat(from_format, ' -> ', to_format) AS pair, count() AS cnt
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_parsed'
            AND ingestion_source != 'legacy_expand'
            AND parse_success = 1
            AND from_format != ''
            AND to_format != ''
          GROUP BY pair
          ORDER BY cnt DESC
          LIMIT 12
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            uniqExact(session_id) AS total_sessions,
            uniqExactIf(session_id, event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS search_sessions,
            countIf(event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS submit_events,
            countIf(event_name = 'search_parsed' AND ingestion_source != 'legacy_expand' AND parse_success = 1) AS parsed_success_events,
            countIf(event_name = 'search_results' AND ingestion_source != 'legacy_expand') AS results_events,
            countIf(event_name = 'search_results' AND ingestion_source != 'legacy_expand' AND matches_count = 0) AS zero_results_events,
            countIf(event_name = 'search_redirect' AND ingestion_source != 'legacy_expand') AS redirects_events,
            countIf(event_name = 'tool_open' AND source = 'search') AS tool_open_from_search_events
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          FORMAT JSON
        `),
        queryClickHouse(`
          WITH
            ${rangeStartSql} AS from_ts,
            now() AS to_ts,
            toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
          SELECT
            count() AS search_sessions,
            countIf(converted = 1) AS converted_sessions,
            quantileExactIf(0.5)(seconds_to_open, converted = 1) AS p50_time_to_tool_sec,
            quantileExactIf(0.95)(seconds_to_open, converted = 1) AS p95_time_to_tool_sec
          FROM
          (
            SELECT
              session_id,
              minIf(event_time, event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS first_submit_at,
              minIf(event_time, event_name = 'tool_open' AND source = 'search') AS first_tool_open_at,
              dateDiff('second', first_submit_at, first_tool_open_at) AS seconds_to_open,
              toUInt8(
                first_submit_at > epoch
                AND first_tool_open_at > epoch
                AND first_tool_open_at >= first_submit_at
                AND first_tool_open_at <= first_submit_at + toIntervalMinute(30)
              ) AS converted
            FROM analytics_events
            WHERE event_time >= from_ts
              AND event_time < to_ts
              AND event_name IN ('search_submit', 'tool_open')
            GROUP BY session_id
            HAVING first_submit_at > epoch
          )
          FORMAT JSON
        `),
        queryClickHouse(`
          WITH
            ${rangeStartSql} AS from_ts,
            toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
          SELECT
            count() AS redirects,
            countIf(no_back_navigation = 1) AS successful_redirects
          FROM
          (
            SELECT
              r.session_id,
              r.event_time AS redirect_at,
              min(s.event_time) AS next_submit_at,
              toUInt8(
                next_submit_at = epoch
                OR next_submit_at > redirect_at + toIntervalSecond(30)
              ) AS no_back_navigation
            FROM
            (
              SELECT session_id, event_time
              FROM analytics_events
              WHERE event_time >= from_ts
                AND event_name = 'search_redirect'
                AND ingestion_source != 'legacy_expand'
            ) AS r
            LEFT JOIN
            (
              SELECT session_id, event_time
              FROM analytics_events
              WHERE event_time >= from_ts
                AND event_name = 'search_submit'
                AND ingestion_source != 'legacy_expand'
            ) AS s
              ON s.session_id = r.session_id
              AND s.event_time > r.event_time
              AND s.event_time <= r.event_time + toIntervalMinute(10)
            GROUP BY r.session_id, redirect_at
          )
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            quantileExact(0.5)(latency_ms) AS p50_latency_ms,
            quantileExact(0.95)(latency_ms) AS p95_latency_ms
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          WHERE event_name = 'search_submit'
            AND ingestion_source != 'legacy_expand'
            AND latency_ms > 0
          FORMAT JSON
        `),
        queryClickHouse(`
          SELECT
            toString(toDate(event_time)) AS day,
            countIf(event_name = 'search_submit' AND ingestion_source != 'legacy_expand') AS searches,
            countIf(event_name = 'search_results' AND ingestion_source != 'legacy_expand' AND matches_count = 0) AS zero_results,
            countIf(event_name = 'search_redirect' AND ingestion_source != 'legacy_expand') AS redirects,
            countIf(event_name = 'tool_open' AND source = 'search') AS tool_opens
          FROM analytics_events
          PREWHERE event_time >= ${rangeStartSql}
          GROUP BY toDate(event_time)
          ORDER BY toDate(event_time) ASC
          FORMAT JSON
        `)
      ]);

      const summary = summaryRows[0] || {};
      const conversion = conversionRows[0] || {};
      const redirects = redirectRows[0] || {};
      const latency = latencyRows[0] || {};
      const submitEvents = asCount(summary.submit_events);
      const resultsEvents = asCount(summary.results_events);
      const redirectsEvents = asCount(summary.redirects_events);

      return res.json({
        range,
        top_queries: topQueriesRows.map((row) => ({
          query: String(row.query || ''),
          count: asCount(row.cnt)
        })).filter((row) => row.query),
        zero_queries: zeroQueriesRows.map((row) => ({
          query: String(row.query || ''),
          count: asCount(row.cnt)
        })).filter((row) => row.query),
        top_from: topFromRows.map((row) => ({
          format: String(row.format || ''),
          count: asCount(row.cnt)
        })).filter((row) => row.format),
        top_to: topToRows.map((row) => ({
          format: String(row.format || ''),
          count: asCount(row.cnt)
        })).filter((row) => row.format),
        top_pairs: topPairsRows.map((row) => ({
          pair: String(row.pair || ''),
          count: asCount(row.cnt)
        })).filter((row) => row.pair),
        summary: {
          total_sessions: asCount(summary.total_sessions),
          search_sessions: asCount(summary.search_sessions),
          converted_sessions: asCount(conversion.converted_sessions),
          search_adoption_pct: ratioOrNull(summary.search_sessions, summary.total_sessions),
          parse_rate_pct: ratioOrNull(summary.parsed_success_events, submitEvents),
          zero_result_rate_pct: ratioOrNull(summary.zero_results_events, resultsEvents),
          conversion_pct: ratioOrNull(conversion.converted_sessions, conversion.search_sessions),
          redirect_share_pct: ratioOrNull(redirectsEvents, submitEvents),
          redirect_success_pct: ratioOrNull(redirects.successful_redirects, redirects.redirects),
          p50_latency_ms: asNullableNumber(latency.p50_latency_ms),
          p95_latency_ms: asNullableNumber(latency.p95_latency_ms),
          p50_time_to_tool_sec: asNullableNumber(conversion.p50_time_to_tool_sec),
          p95_time_to_tool_sec: asNullableNumber(conversion.p95_time_to_tool_sec)
        },
        funnel: {
          submit: submitEvents,
          parsed_success: asCount(summary.parsed_success_events),
          results: resultsEvents,
          zero_results: asCount(summary.zero_results_events),
          redirects: redirectsEvents,
          tool_open_from_search: asCount(summary.tool_open_from_search_events)
        },
        daily: dailyRows.map((row) => ({
          day: String(row.day || '').trim(),
          searches: asCount(row.searches),
          zero_results: asCount(row.zero_results),
          redirects: asCount(row.redirects),
          tool_opens: asCount(row.tool_opens)
        })).filter((row) => row.day)
      });
    }

    const endMs = Date.now();
    const startMs = endMs - rangeDurationMs;
    const fallbackEvents = await readAnalyticsFallbackEvents();
    const insights = buildSearchInsightsFromEvents(fallbackEvents, {
      startMs,
      endMs,
      queryLimit: 20,
      formatLimit: 10,
      pairLimit: 12,
      includeDaily: true
    });
    return res.json({
      range,
      ...insights
    });
  } catch (error) {
    logError({
      type: 'admin_metrics_search_failed',
      requestId: req.requestId,
      range,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'METRICS_QUERY_FAILED',
      message: 'Failed to query search metrics',
      requestId: req.requestId
    });
  }
});

app.get('/admin/metrics/posts', requireAdminAuth, async (req, res) => {
  const { range, rangeDurationMs } = resolveSearchRange(req.query.range);
  const nowMs = Date.now();
  const rangeStartMs = nowMs - rangeDurationMs;
  const prevRangeStartMs = rangeStartMs - rangeDurationMs;

  try {
    const posts = listAdminPosts();
    const likes = loadPostLikesStore();

    const likesCurrentByPost = new Map();
    const likesPrevByPost = new Map();
    for (const like of likes) {
      const postId = String(like?.post_id || '').trim();
      if (!postId) continue;
      const ts = Date.parse(like.created_at || '');
      if (!Number.isFinite(ts)) continue;
      if (ts >= rangeStartMs) {
        likesCurrentByPost.set(postId, (likesCurrentByPost.get(postId) || 0) + 1);
      } else if (ts >= prevRangeStartMs && ts < rangeStartMs) {
        likesPrevByPost.set(postId, (likesPrevByPost.get(postId) || 0) + 1);
      }
    }

    const postIdBySlug = new Map(posts.map((post) => [String(post.slug || '').trim(), String(post.id || '').trim()]));
    const opensByPost = new Map();
    let analyticsAvailable = false;
    if (isClickHouseAnalyticsEnabled()) {
      analyticsAvailable = true;
      const sqlRangeStart = new Date(rangeStartMs).toISOString();
      const openRows = await queryClickHouse(`
        SELECT
          tool_id,
          count() AS opens
        FROM analytics_events
        WHERE event_name = 'post_open'
          AND event_time >= toDateTime('${sqlRangeStart}')
          AND tool_id != ''
        GROUP BY tool_id
        FORMAT JSON
      `);
      for (const row of openRows) {
        const rawId = String(row.tool_id || '').trim();
        if (!rawId) continue;
        const postId = postIdBySlug.get(rawId) || rawId;
        opensByPost.set(postId, asCount(row.opens));
      }
    } else if (canUseAnalyticsFallback()) {
      const fallbackEvents = await readAnalyticsFallbackEvents();
      analyticsAvailable = true;
      for (const event of fallbackEvents) {
        if (event.event_name !== 'post_open') continue;
        if (event.event_time_ms < rangeStartMs || event.event_time_ms > nowMs) continue;
        const rawId = String(event.tool_id || '').trim();
        if (!rawId) continue;
        const postId = postIdBySlug.get(rawId) || rawId;
        opensByPost.set(postId, asCount(opensByPost.get(postId)) + 1);
      }
    }

    const rows = posts
      .map((post) => {
        const postId = String(post.id || '').trim();
        const likesCurrent = asCount(likesCurrentByPost.get(postId));
        const likesPrev = asCount(likesPrevByPost.get(postId));
        const likesTotal = asCount(post.likes_count);
        const opens = analyticsAvailable ? asCount(opensByPost.get(postId)) : null;
        const likeRate = typeof opens === 'number' && opens > 0
          ? Number((likesCurrent / opens).toFixed(4))
          : null;
        const growth = likesPrev > 0
          ? Number(((likesCurrent - likesPrev) / likesPrev).toFixed(4))
          : null;
        return {
          post_id: postId,
          slug: String(post.slug || '').trim(),
          title: String(post.title || '').trim(),
          likes: likesCurrent,
          likes_total: likesTotal,
          likes_prev: likesPrev,
          opens,
          like_rate: likeRate,
          growth
        };
      })
      .filter((row) => row.likes > 0 || row.likes_total > 0 || (typeof row.opens === 'number' && row.opens > 0))
      .sort((left, right) => {
        if (right.likes !== left.likes) return right.likes - left.likes;
        const rightOpens = typeof right.opens === 'number' ? right.opens : -1;
        const leftOpens = typeof left.opens === 'number' ? left.opens : -1;
        if (rightOpens !== leftOpens) return rightOpens - leftOpens;
        if (right.likes_total !== left.likes_total) return right.likes_total - left.likes_total;
        return left.title.localeCompare(right.title);
      })
      .slice(0, 10);

    return res.json({
      range,
      analytics_available: analyticsAvailable,
      top_liked: rows
    });
  } catch (error) {
    logError({
      type: 'admin_metrics_posts_failed',
      requestId: req.requestId,
      range,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'METRICS_QUERY_FAILED',
      message: 'Failed to query posts metrics',
      requestId: req.requestId
    });
  }
});

app.get('/admin/metrics/promo', requireAdminAuth, async (req, res) => {
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

  const { range, rangeDurationMs } = resolveSearchRange(req.query.range);
  const nowMs = Date.now();
  const rangeStartIso = new Date(nowMs - rangeDurationMs).toISOString();
  const prevRangeStartIso = new Date(nowMs - (2 * rangeDurationMs)).toISOString();

  try {
    const [
      totalsRows,
      rangeRows,
      topRows,
      dailyRows
    ] = await Promise.all([
      promoStorage.pool.query(
        `
          SELECT
            count(*)::int AS total_codes,
            count(*) FILTER (WHERE is_active)::int AS active_codes
          FROM promo_codes
        `
      ),
      promoStorage.pool.query(
        `
          SELECT
            count(*)::int AS redemptions,
            count(DISTINCT user_id)::int AS unique_users
          FROM promo_redemptions
          WHERE created_at >= $1::timestamptz
        `,
        [rangeStartIso]
      ),
      promoStorage.pool.query(
        `
          WITH current_range AS (
            SELECT
              promo_code_id,
              count(*)::int AS redemptions,
              count(DISTINCT user_id)::int AS unique_users
            FROM promo_redemptions
            WHERE created_at >= $1::timestamptz
            GROUP BY promo_code_id
          ),
          prev_range AS (
            SELECT
              promo_code_id,
              count(*)::int AS redemptions_prev
            FROM promo_redemptions
            WHERE created_at >= $2::timestamptz
              AND created_at < $1::timestamptz
            GROUP BY promo_code_id
          ),
          total_range AS (
            SELECT
              promo_code_id,
              count(*)::int AS redemptions_total
            FROM promo_redemptions
            GROUP BY promo_code_id
          )
          SELECT
            p.id,
            p.code,
            coalesce(c.redemptions, 0)::int AS redemptions,
            coalesce(c.unique_users, 0)::int AS unique_users,
            coalesce(pr.redemptions_prev, 0)::int AS redemptions_prev,
            coalesce(t.redemptions_total, 0)::int AS redemptions_total
          FROM promo_codes p
          LEFT JOIN current_range c ON c.promo_code_id = p.id
          LEFT JOIN prev_range pr ON pr.promo_code_id = p.id
          LEFT JOIN total_range t ON t.promo_code_id = p.id
          WHERE coalesce(c.redemptions, 0) > 0
             OR coalesce(t.redemptions_total, 0) > 0
          ORDER BY
            coalesce(c.redemptions, 0) DESC,
            coalesce(t.redemptions_total, 0) DESC,
            p.code ASC
          LIMIT 20
        `,
        [rangeStartIso, prevRangeStartIso]
      ),
      promoStorage.pool.query(
        `
          SELECT
            to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            count(*)::int AS redemptions
          FROM promo_redemptions
          WHERE created_at >= $1::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        [rangeStartIso]
      )
    ]);

    const totals = totalsRows.rows[0] || {};
    const rangeTotals = rangeRows.rows[0] || {};

    return res.json({
      range,
      totals: {
        total_codes: asCount(totals.total_codes),
        active_codes: asCount(totals.active_codes),
        redemptions: asCount(rangeTotals.redemptions),
        unique_users: asCount(rangeTotals.unique_users)
      },
      top_codes: topRows.rows.map((row) => {
        const redemptions = asCount(row.redemptions);
        const redemptionsPrev = asCount(row.redemptions_prev);
        const growth = redemptionsPrev > 0
          ? Number(((redemptions - redemptionsPrev) / redemptionsPrev).toFixed(4))
          : null;
        return {
          promo_id: String(row.id || '').trim(),
          code: String(row.code || '').trim(),
          redemptions,
          unique_users: asCount(row.unique_users),
          redemptions_prev: redemptionsPrev,
          redemptions_total: asCount(row.redemptions_total),
          growth
        };
      }).filter((row) => row.code),
      daily: dailyRows.rows.map((row) => ({
        day: String(row.day || '').trim(),
        redemptions: asCount(row.redemptions)
      })).filter((row) => row.day)
    });
  } catch (error) {
    const code = promoSchemaUnavailableStatus(error) ? 'PROMO_SCHEMA_NOT_READY' : 'METRICS_QUERY_FAILED';
    const message = promoSchemaUnavailableStatus(error)
      ? 'Promo schema is not ready'
      : 'Failed to query promo metrics';
    logError({
      type: 'admin_metrics_promo_failed',
      requestId: req.requestId,
      range,
      error: error?.message || 'unknown'
    });
    const statusCode = code === 'PROMO_SCHEMA_NOT_READY' ? 503 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code,
      message,
      requestId: req.requestId
    });
  }
});
app.use('/files', express.static(localRoot));

app.post('/crypto/session', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const clientId = getClientId(req);
    const allowed = await rateLimit(`rl:crypto:${clientId}`, 30, 60);
    if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many requests', requestId: req.requestId });

    const sessionId = uuidv4();
    const kp = nacl.box.keyPair();
    await withTimeout(connection.setex(`zk:session:${sessionId}`, ZK_SESSION_TTL_SEC, bytesToB64(kp.secretKey)), REDIS_OP_TIMEOUT_MS, 'redis_setex_timeout');
    return res.json({ sessionId, publicKey: bytesToB64(kp.publicKey), expiresIn: ZK_SESSION_TTL_SEC });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'redis_unavailable'));
    }
    logError({ type: 'crypto_session_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'SESSION_CREATE_FAILED', message: 'Failed to create crypto session', requestId: req.requestId });
  }
});

app.get('/crypto/worker-pubkey', (req, res) => {
  const pub = process.env.WORKER_KEY_PUBLIC;
  if (!pub) return res.status(500).json({ status: 'error', code: 'MISSING_WORKER_KEY', message: 'Worker public key not configured', requestId: req.requestId });
  res.json({ publicKey: pub });
});

app.post('/uploads/sign', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const clientId = getClientId(req);
    const allowed = await rateLimit(`rl:upload:${clientId}`, RATE_LIMIT_UPLOADS_PER_MIN, 60);
    if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many uploads', requestId: req.requestId });

    if (storageMode !== 's3') {
      return res.status(400).json({ status: 'error', code: 'STORAGE_NOT_S3', message: 'Presigned upload requires S3-compatible storage', requestId: req.requestId });
    }
    await ensureBucketAvailable();
    const { filename, contentType, size } = req.body || {};
    if (!filename) return res.status(400).json({ status: 'error', code: 'MISSING_FILENAME', message: 'Missing filename', requestId: req.requestId });
    if (!size || Number(size) <= 0) return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    if (Number(size) > MAX_FILE_SIZE) return res.status(400).json({ status: 'error', code: 'FILE_TOO_LARGE', message: 'File exceeds size limit', requestId: req.requestId });

    const safeName = sanitizeFileName(filename);
    const key = `inputs/${uuidv4()}/${safeName}`;
    const type = contentType || 'application/octet-stream';

    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: type
    }), { expiresIn: 60 * 15 });

    return res.json({ uploadUrl, inputKey: key, expiresIn: 900, requestId: req.requestId });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'redis_unavailable'));
    }
    logError({ type: 'upload_sign_failed', requestId: req.requestId, error: err.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'UPLOAD_SIGN_FAILED', message: 'Failed to create upload URL', requestId: req.requestId });
  }
});

app.post('/uploads/proxy', express.raw({ type: '*/*', limit: '1100mb' }), async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const clientId = getClientId(req);
    const allowed = await rateLimit(`rl:upload:${clientId}`, RATE_LIMIT_UPLOADS_PER_MIN, 60);
    if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many uploads', requestId: req.requestId });

    if (storageMode !== 's3') {
      return res.status(400).json({ status: 'error', code: 'STORAGE_NOT_S3', message: 'Proxy upload requires S3-compatible storage', requestId: req.requestId });
    }
    await ensureBucketAvailable();

    const inputKey = String(req.headers['x-input-key'] || '').trim();
    const fileName = String(req.headers['x-file-name'] || '').trim();
    const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0];
    const declaredSize = Number(req.headers['x-file-size'] || 0);
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!inputKey) {
      return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Missing input key', requestId: req.requestId });
    }
    if (!inputKey.startsWith('inputs/')) {
      return res.status(400).json({ status: 'error', code: 'INVALID_INPUT_KEY', message: 'Invalid input key', requestId: req.requestId });
    }
    if (!fileName) {
      return res.status(400).json({ status: 'error', code: 'MISSING_FILENAME', message: 'Missing filename', requestId: req.requestId });
    }
    if (!body.length) {
      return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    }
    if (body.length > MAX_FILE_SIZE) {
      return res.status(400).json({ status: 'error', code: 'FILE_TOO_LARGE', message: 'File exceeds size limit', requestId: req.requestId });
    }
    if (declaredSize > 0 && declaredSize !== body.length) {
      return res.status(400).json({ status: 'error', code: 'SIZE_MISMATCH', message: 'Uploaded size mismatch', requestId: req.requestId });
    }

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: inputKey,
      ContentType: contentType || 'application/octet-stream',
      Body: body
    }));

    return res.json({ ok: true, inputKey, requestId: req.requestId });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'redis_unavailable'));
    }
    logError({ type: 'upload_proxy_failed', requestId: req.requestId, error: err.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'UPLOAD_PROXY_FAILED', message: 'Failed proxy upload', requestId: req.requestId });
  }
});

app.post('/auth/2fa/start', async (req, res) => {
  try {
    pruneExpiredTwofa();
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ status: 'error', code: 'MISSING_EMAIL', message: 'Missing email', requestId: req.requestId });
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    twofaCodes.set(email, { code, expiresAt });
    await sendTwofaEmail(email, code);
    return res.json({ ok: true });
  } catch (err) {
    logError({ type: 'twofa_start_failed', requestId: req.requestId, error: err.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'EMAIL_SEND_FAILED', message: 'Failed to send code', requestId: req.requestId });
  }
});

app.post('/auth/2fa/verify', (req, res) => {
  pruneExpiredTwofa();
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ status: 'error', code: 'MISSING_FIELDS', message: 'Missing email or code', requestId: req.requestId });
  const record = twofaCodes.get(email);
  if (!record || record.expiresAt < Date.now() || record.code !== String(code)) {
    return res.status(400).json({ status: 'error', code: 'INVALID_CODE', message: 'Invalid code', requestId: req.requestId });
  }
  const token = generateToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  twofaTokens.set(token, { email, expiresAt });
  twofaCodes.delete(email);
  return res.json({ ok: true, token });
});

app.post('/auth/2fa/verify-token', (req, res) => {
  pruneExpiredTwofa();
  const { email, token } = req.body || {};
  if (!email || !token) return res.status(400).json({ ok: false });
  const record = twofaTokens.get(token);
  if (!record || record.expiresAt < Date.now() || record.email !== email) {
    return res.status(200).json({ ok: false });
  }
  return res.json({ ok: true });
});

app.post('/jobs', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const clientId = getClientId(req);
    const allowed = await rateLimit(`rl:jobs:${clientId}`, RATE_LIMIT_JOBS_PER_MIN, 60);
    if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many jobs', requestId: req.requestId });

    const tool = req.body.tool;
    const batch = String(req.body.batch || 'false') === 'true';
    const settings = typeof req.body.settings === 'string' ? JSON.parse(req.body.settings) : (req.body.settings || {});
    if (!tool) return res.status(400).json({ status: 'error', code: 'MISSING_TOOL', message: 'Missing tool', requestId: req.requestId });
    if (!TOOL_IDS.has(tool)) return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TOOL', message: 'Unsupported tool', requestId: req.requestId });

    const jobId = uuidv4();
    const toolMeta = TOOL_META[tool];
    const timeout = toolMeta?.timeoutMs || 180000;
    const encryption = req.body.encryption || null;
    if (encryption?.enabled) {
      const sessionId = encryption.sessionId;
      if (!sessionId) return res.status(400).json({ status: 'error', code: 'MISSING_SESSION', message: 'Missing encryption session', requestId: req.requestId });
      const exists = await withTimeout(connection.exists(`zk:session:${sessionId}`), REDIS_OP_TIMEOUT_MS, 'redis_exists_timeout');
      if (!exists) return res.status(400).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Encryption session expired', requestId: req.requestId });
      const refreshed = await withTimeout(connection.expire(`zk:session:${sessionId}`, ZK_SESSION_TTL_SEC), REDIS_OP_TIMEOUT_MS, 'redis_expire_timeout');
      if (!refreshed) return res.status(400).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Encryption session expired', requestId: req.requestId });
    }

    if (batch) {
      const inputItems = [];
      const incomingItems = Array.isArray(req.body.items) ? req.body.items : [];
      if (!incomingItems.length) return res.status(400).json({ status: 'error', code: 'MISSING_ITEMS', message: 'Missing items', requestId: req.requestId });
      for (const item of incomingItems) {
        const safeName = sanitizeFileName(item.originalName || 'input');
        const inputKey = item.inputKey;
        if (!inputKey) return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Missing input key', requestId: req.requestId });
        if (!String(inputKey).startsWith('inputs/')) return res.status(400).json({ status: 'error', code: 'INVALID_INPUT_KEY', message: 'Invalid input key', requestId: req.requestId });
        const base = path.parse(safeName).name || 'output';
        const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
        const outputName = `${base}.${ext}`;
        const outputKey = `outputs/${jobId}/${outputName}`;
        const inputFormat = (item.inputFormat || path.extname(safeName).replace('.', '') || '').toLowerCase();
        const inputSize = Number(item.inputSize || 0);
        const encryptedSize = Number(item.encryptedSize || 0);
        if (!inputSize || inputSize <= 0) return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
        if (inputSize > MAX_FILE_SIZE) return res.status(400).json({ status: 'error', code: 'FILE_TOO_LARGE', message: 'File exceeds size limit', requestId: req.requestId });
        if (toolMeta?.inputExts?.length && !toolMeta.inputExts.includes(inputFormat)) {
          return res.status(400).json({ status: 'error', code: 'INVALID_FORMAT', message: 'Unsupported input format', requestId: req.requestId });
        }
        if (encryption?.enabled && (!item.encryption || !item.encryption.ivBase || !item.encryption.totalChunks || !item.encryption.chunkSize)) {
          return res.status(400).json({ status: 'error', code: 'MISSING_ENCRYPTION_META', message: 'Missing encryption metadata', requestId: req.requestId });
        }
        if (storageMode === 's3') {
          const head = await headObject(inputKey);
          if (!head) return res.status(400).json({ status: 'error', code: 'INPUT_NOT_FOUND', message: 'Input not found', requestId: req.requestId });
          if (encryptedSize && head.size !== encryptedSize) return res.status(400).json({ status: 'error', code: 'SIZE_MISMATCH', message: 'Encrypted size mismatch', requestId: req.requestId });
        }
        inputItems.push({
          inputKey,
          outputKey,
          originalName: safeName,
          inputFormat,
          inputSize,
          encryptedSize,
          encryption: item.encryption || null
        });
      }

      const batchOutputKey = `outputs/${jobId}/batch_${tool}.zip`;
      await withTimeout(queue.add('convert', {
        jobId,
        tool,
        batch: true,
        items: inputItems,
        outputKey: batchOutputKey,
        settings,
        inputFormats: inputItems.map((i) => i.inputFormat).filter(Boolean),
        inputSize: inputItems.reduce((sum, i) => sum + (i.inputSize || 0), 0),
        requestId: req.requestId,
        encryption
      }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
      log({ type: 'job_created', requestId: req.requestId, jobId, tool, batch: true, count: inputItems.length });
      return res.json({ jobId, requestId: req.requestId });
    }

    const inputKey = req.body.inputKey;
    const originalName = req.body.originalName || 'input';
    const safeName = sanitizeFileName(originalName);
    if (!inputKey) return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Missing input key', requestId: req.requestId });
    if (!String(inputKey).startsWith('inputs/')) return res.status(400).json({ status: 'error', code: 'INVALID_INPUT_KEY', message: 'Invalid input key', requestId: req.requestId });
    const inputFormat = (req.body.inputFormat || path.extname(safeName).replace('.', '') || '').toLowerCase();
    const inputSize = Number(req.body.inputSize || 0);
    const encryptedSize = Number(req.body.encryptedSize || 0);
    if (!inputSize || inputSize <= 0) return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    if (inputSize > MAX_FILE_SIZE) return res.status(400).json({ status: 'error', code: 'FILE_TOO_LARGE', message: 'File exceeds size limit', requestId: req.requestId });
    if (toolMeta?.inputExts?.length && !toolMeta.inputExts.includes(inputFormat)) {
      return res.status(400).json({ status: 'error', code: 'INVALID_FORMAT', message: 'Unsupported input format', requestId: req.requestId });
    }
    if (encryption?.enabled && (!encryption.ivBase || !encryption.totalChunks || !encryption.chunkSize)) {
      return res.status(400).json({ status: 'error', code: 'MISSING_ENCRYPTION_META', message: 'Missing encryption metadata', requestId: req.requestId });
    }
    if (storageMode === 's3') {
      const head = await headObject(inputKey);
      if (!head) return res.status(400).json({ status: 'error', code: 'INPUT_NOT_FOUND', message: 'Input not found', requestId: req.requestId });
      if (encryptedSize && head.size !== encryptedSize) return res.status(400).json({ status: 'error', code: 'SIZE_MISMATCH', message: 'Encrypted size mismatch', requestId: req.requestId });
    }

    const base = path.parse(safeName).name || 'output';
    const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
    const outputName = `${base}.${ext}`;
    const outputKey = `outputs/${jobId}/${outputName}`;

    await withTimeout(queue.add('convert', {
      jobId,
      tool,
      inputKey,
      outputKey,
      originalName: safeName,
      settings,
      inputFormat,
      inputSize,
      requestId: req.requestId,
      encryption
    }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
    log({ type: 'job_created', requestId: req.requestId, jobId, tool, batch: false, count: 1, inputSize, inputFormat });

    res.json({ jobId, requestId: req.requestId });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'queue_unavailable'));
    }
    logError({ type: 'job_error', requestId: req.requestId, error: err.message || 'unknown' });
    res.status(500).json({ status: 'error', code: 'JOB_CREATE_FAILED', message: 'Failed to create job', requestId: req.requestId });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found', requestId: req.requestId });

    const state = await job.getState();
    const progress = job.progress || 0;
    let downloadUrl = null;
    let error = null;

    if (state === 'completed') {
      const outputKey = (job.returnvalue && job.returnvalue.outputKey) || job.data.outputKey;
      if (storageMode === 's3') {
        const signed = await getSignedUrl(s3, new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: outputKey
        }), { expiresIn: 60 * 60 });
        downloadUrl = signed;
      } else {
        downloadUrl = `/files/${outputKey}`;
      }
    }
    if (state === 'failed') {
      error = {
        code: 'CONVERSION_FAILED',
        message: job.failedReason || 'Conversion failed'
      };
    }

    const outputMeta = job.returnvalue && job.returnvalue.outputMeta ? job.returnvalue.outputMeta : null;
    res.json({ status: state, progress, downloadUrl, outputMeta, error });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'queue_unavailable'));
    }
    logError({ type: 'job_fetch_failed', requestId: req.requestId, error: err.message || 'unknown' });
    res.status(500).json({ status: 'error', code: 'JOB_FETCH_FAILED', message: 'Failed to fetch job', requestId: req.requestId });
  }
});

const port = process.env.PORT || 3000;
startAnalyticsFlushLoop();
if (ANALYTICS_ENABLED && !CLICKHOUSE_URL && !canUseAnalyticsFallback()) {
  logError({ type: 'analytics_disabled_no_clickhouse_url' });
}
if (!isClickHouseAnalyticsEnabled() && canUseAnalyticsFallback()) {
  log({
    type: 'analytics_clickhouse_disabled_using_fallback',
    fallbackFile: ANALYTICS_FALLBACK_FILE
  });
}
if (PROMO_CODES_ENABLED && !DATABASE_URL) {
  logError({ type: 'promo_disabled_no_database_url' });
}
if (PROMO_CODES_ENABLED && DATABASE_URL) {
  const pool = getPgPool();
  if (!pool && pgPoolInitError) {
    logError({
      type: 'promo_db_unavailable_at_boot',
      error: pgPoolInitError?.message || 'unknown'
    });
  }
}
const server = app.listen(port, () => console.log(`API listening on ${port}`));

app.use((err, req, res, next) => {
  logError({
    type: 'unhandled_http_error',
    requestId: req.requestId || null,
    path: req.path || null,
    error: err?.message || 'unknown'
  });
  if (res.headersSent) return next(err);
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    requestId: req.requestId
  });
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log({ type: 'shutdown_start', signal });
  const forceTimer = setTimeout(() => {
    logError({ type: 'shutdown_forced', signal });
    process.exit(1);
  }, 15000);
  if (typeof forceTimer.unref === 'function') forceTimer.unref();
  try {
    await new Promise((resolve) => server.close(resolve));
    if (analyticsFlushTimer) {
      clearInterval(analyticsFlushTimer);
      analyticsFlushTimer = null;
    }
    await flushAnalyticsBuffer('shutdown');
    await Promise.allSettled([
      queue.close(),
      connection.quit(),
      pgPool ? pgPool.end() : Promise.resolve()
    ]);
    clearTimeout(forceTimer);
    log({ type: 'shutdown_complete', signal });
    process.exit(0);
  } catch (error) {
    clearTimeout(forceTimer);
    logError({ type: 'shutdown_error', signal, error: error?.message || 'unknown' });
    process.exit(1);
  }
};

process.on('SIGINT', () => { shutdown('SIGINT'); });
process.on('SIGTERM', () => { shutdown('SIGTERM'); });

