const path = require('path');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { TOOL_EXT, TOOL_IDS } = require('../../shared/tools');
const { createAuthRouter } = require('./auth.controller');
const { createMessengerRouter } = require('../routes/messenger');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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

const DEFAULT_CORS_ORIGINS = [
  'https://megaconvert-web.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const parseCorsOrigins = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const allowedCorsOrigins = new Set([
  ...DEFAULT_CORS_ORIGINS,
  ...parseCorsOrigins(process.env.CORS_ORIGIN),
  ...parseCorsOrigins(process.env.CORS_ORIGINS)
]);

const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = String(req.header('Origin') || '').trim();
  const baseOptions = {
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id', 'x-session-id', 'x-request-id'],
    optionsSuccessStatus: 204,
    maxAge: 86400
  };

  // Non-browser or same-origin requests can pass through without Origin header.
  if (!requestOrigin) {
    callback(null, { ...baseOptions, origin: true });
    return;
  }

  if (allowedCorsOrigins.has(requestOrigin)) {
    callback(null, { ...baseOptions, origin: requestOrigin });
    return;
  }

  callback(null, { ...baseOptions, origin: false });
};

const app = express();
app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));
app.use(express.json({ limit: '10mb' }));
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
      durationMs: Date.now() - start
    });
  });
  next();
});

app.use('/api/auth', createAuthRouter());
app.use('/api', createMessengerRouter());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('convert', { connection });

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

const twofaCodes = new Map(); // email -> { code, expiresAt }
const twofaTokens = new Map(); // token -> { email, expiresAt }

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
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

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
}

function localPathForKey(key) {
  return path.join(localRoot, key);
}

function sanitizeFileName(name) {
  return name.replace(/[\\/]/g, '_').replace(/\s+/g, '_');
}

app.get('/health', (req, res) => res.json({ ok: true, storage: storageMode }));
app.post('/events', (req, res) => {
  const { type, payload, ts } = req.body || {};
  if (!type) return res.status(400).json({ status: 'error', code: 'MISSING_TYPE', message: 'Missing type', requestId: req.requestId });
  log({ type: 'event', requestId: req.requestId, event: type, payload: payload || {}, ts: ts || Date.now() });
  return res.json({ ok: true });
});
app.use('/files', express.static(localRoot));

app.post('/auth/2fa/start', async (req, res) => {
  try {
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
  const { email, token } = req.body || {};
  if (!email || !token) return res.status(400).json({ ok: false });
  const record = twofaTokens.get(token);
  if (!record || record.expiresAt < Date.now() || record.email !== email) {
    return res.status(200).json({ ok: false });
  }
  return res.json({ ok: true });
});

app.post('/jobs', upload.any(), async (req, res) => {
  try {
    const tool = req.body.tool;
    const files = req.files || [];
    const batch = String(req.body.batch || 'false') === 'true';
    const settings = req.body.settings ? JSON.parse(req.body.settings) : {};
    if (!tool) return res.status(400).json({ status: 'error', code: 'MISSING_TOOL', message: 'Missing tool', requestId: req.requestId });
    if (!TOOL_IDS.has(tool)) return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TOOL', message: 'Unsupported tool', requestId: req.requestId });
    if (!files.length) return res.status(400).json({ status: 'error', code: 'MISSING_FILE', message: 'Missing file', requestId: req.requestId });
    if (files.some((f) => f.size === 0)) return res.status(400).json({ status: 'error', code: 'EMPTY_FILE', message: 'File is empty', requestId: req.requestId });

    const jobId = uuidv4();
    const inputSizeTotal = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const inputFormats = files.map((f) => path.extname(f.originalname || '').replace('.', '').toLowerCase()).filter(Boolean);

    if (batch && files.length > 1) {
      const inputItems = [];
      for (const file of files) {
        const safeName = sanitizeFileName(file.originalname || 'input');
        const inputKey = `inputs/${jobId}/${safeName}`;
        const base = path.parse(safeName).name || 'output';
        const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
        const outputName = `${base}.${ext}`;
        const outputKey = `outputs/${jobId}/${outputName}`;
        const inputFormat = path.extname(safeName).replace('.', '').toLowerCase();

        if (storageMode === 's3') {
          await s3.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: inputKey,
            Body: file.buffer,
            ContentType: file.mimetype
          }));
        } else {
          const outPath = localPathForKey(inputKey);
          ensureDir(outPath);
          require('fs').writeFileSync(outPath, file.buffer);
        }
        inputItems.push({ inputKey, outputKey, originalName: safeName, inputFormat, inputSize: file.size || 0 });
      }

      const batchOutputKey = `outputs/${jobId}/batch_${tool}.zip`;
      await queue.add('convert', {
        jobId,
        tool,
        batch: true,
        items: inputItems,
        outputKey: batchOutputKey,
        settings,
        inputFormats,
        inputSize: inputSizeTotal,
        requestId: req.requestId
      }, { jobId });
      log({ type: 'job_created', requestId: req.requestId, jobId, tool, batch: true, count: inputItems.length, inputSize: inputSizeTotal });
      return res.json({ jobId, requestId: req.requestId });
    }

    const file = files[0];
    const safeName = sanitizeFileName(file.originalname || 'input');
    const inputKey = `inputs/${jobId}/${safeName}`;
    const inputFormat = path.extname(safeName).replace('.', '').toLowerCase();

    const base = path.parse(safeName).name || 'output';
    const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
    const outputName = `${base}.${ext}`;
    const outputKey = `outputs/${jobId}/${outputName}`;

    if (storageMode === 's3') {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: inputKey,
        Body: file.buffer,
        ContentType: file.mimetype
      }));
    } else {
      const outPath = localPathForKey(inputKey);
      ensureDir(outPath);
      require('fs').writeFileSync(outPath, file.buffer);
    }

    await queue.add('convert', {
      jobId,
      tool,
      inputKey,
      outputKey,
      originalName: safeName,
      settings,
      inputFormat,
      inputSize: file.size || 0,
      requestId: req.requestId
    }, { jobId });
    log({ type: 'job_created', requestId: req.requestId, jobId, tool, batch: false, count: 1, inputSize: file.size || 0, inputFormat });

    res.json({ jobId, requestId: req.requestId });
  } catch (err) {
    logError({ type: 'job_error', requestId: req.requestId, error: err.message || 'unknown' });
    res.status(500).json({ status: 'error', code: 'JOB_CREATE_FAILED', message: 'Failed to create job', requestId: req.requestId });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
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

    res.json({ status: state, progress, downloadUrl, error });
  } catch (err) {
    logError({ type: 'job_fetch_failed', requestId: req.requestId, error: err.message || 'unknown' });
    res.status(500).json({ status: 'error', code: 'JOB_FETCH_FAILED', message: 'Failed to fetch job', requestId: req.requestId });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
