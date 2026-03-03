/* eslint-disable no-console */
const coreChecks = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/health/worker' },
  { method: 'GET', path: '/health/storage' },
  { method: 'GET', path: '/health/ai' },
  { method: 'GET', path: '/metrics/ops' }
];

const extendedChecks = [
  { method: 'POST', path: '/flags/evaluate', body: { flags: ['smart_auto_convert', 'public_share_links'] } },
  { method: 'GET', path: '/share/expiry-presets' },
  { method: 'GET', path: '/admin/settings/platform' },
  { method: 'GET', path: '/admin/audit-logs' }
];

const run = async () => {
  const base = process.env.MC_API_BASE || 'http://localhost:3000';
  const strictExtended = String(process.env.MC_STRICT_EXTENDED || '0') === '1';
  const checks = strictExtended ? [...coreChecks, ...extendedChecks] : coreChecks;
  let failed = false;

  try {
    await fetch(`${base}/health/worker/ping`, { method: 'POST' });
  } catch (error) {
    console.log(`WARN worker ping failed -> ${error.message}`);
  }

  for (const check of checks) {
    const method = check.method || 'GET';
    const path = check.path;
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, {
        method,
        headers: check.body ? { 'Content-Type': 'application/json' } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined
      });
      const contentType = String(res.headers.get('content-type') || '').toLowerCase();
      const body = contentType.includes('application/json') ? await res.json() : null;
      const ok = res.ok && (body ? body.ok !== false : true);
      console.log(`${ok ? 'OK ' : 'BAD'} ${method} ${path} -> ${res.status}`);
      if (!ok) failed = true;
    } catch (error) {
      failed = true;
      console.log(`ERR ${method} ${path} -> ${error.message}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    console.log('Operational smoke checks failed.');
  } else {
    console.log('Operational smoke checks passed.');
  }
};

run();
