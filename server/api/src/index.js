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
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const storageMode = (process.env.STORAGE_MODE || 's3').toLowerCase();
const required = ['REDIS_URL'];
if (storageMode === 's3') {
  required.push('S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET');
}
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing env: ${key}`);
  }
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      type: 'http',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start
    }));
  });
  next();
});

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

const TOOL_EXT = {
  'pdf-word': 'docx',
  'pdf-excel': 'xlsx',
  'pdf-pptx': 'pptx',
  'word-pdf': 'pdf',
  'excel-pdf': 'pdf',
  'pptx-pdf': 'pdf',
  'pdf-txt': 'txt',
  'txt-pdf': 'pdf',
  'pdf-images': 'zip',
  'image-pdf': 'pdf',
  'jpg-webp': 'webp',
  'png-webp': 'webp',
  'heic-jpg': 'jpg',
  'avif-jpg': 'jpg',
  'avif-png': 'png',
  'svg-png': 'png',
  'svg-jpg': 'jpg',
  'mp4-mp3': 'mp3',
  'mp4-gif': 'gif',
  'mov-mp4': 'mp4',
  'mkv-mp4': 'mp4',
  'avi-mp4': 'mp4',
  'video-webm': 'webm',
  'mp3-wav': 'wav',
  'wav-mp3': 'mp3',
  'm4a-mp3': 'mp3',
  'flac-mp3': 'mp3',
  'ogg-mp3': 'mp3',
  'audio-aac': 'aac',
  'zip-rar': 'rar',
  'rar-zip': 'zip',
  '7z-zip': 'zip',
  'zip-tar': 'tar',
  'png-jpg': 'jpg',
  'jpg-png': 'png',
  'jpg-pdf': 'pdf',
  'compress-pdf': 'pdf',
  'compress-video': 'mp4',
  'ocr': 'txt',
  'cad-pdf': 'pdf'
};

function sanitizeFileName(name) {
  return name.replace(/[\\/]/g, '_').replace(/\s+/g, '_');
}

app.get('/health', (req, res) => res.json({ ok: true, storage: storageMode }));
app.post('/events', (req, res) => {
  const { type, payload, ts } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Missing type' });
  console.log(JSON.stringify({ type: 'event', event: type, payload: payload || {}, ts: ts || Date.now() }));
  return res.json({ ok: true });
});
app.use('/files', express.static(localRoot));

app.post('/auth/2fa/start', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    twofaCodes.set(email, { code, expiresAt });
    await sendTwofaEmail(email, code);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send code' });
  }
});

app.post('/auth/2fa/verify', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });
  const record = twofaCodes.get(email);
  if (!record || record.expiresAt < Date.now() || record.code !== String(code)) {
    return res.status(400).json({ error: 'Invalid code' });
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
    if (!tool) return res.status(400).json({ error: 'Missing tool' });
    if (!files.length) return res.status(400).json({ error: 'Missing file' });

    const jobId = uuidv4();

      if (batch && files.length > 1) {
      const inputItems = [];
      for (const file of files) {
        const safeName = sanitizeFileName(file.originalname || 'input');
        const inputKey = `inputs/${jobId}/${safeName}`;
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
        inputItems.push({ inputKey, outputKey, originalName: safeName });
      }

      const batchOutputKey = `outputs/${jobId}/batch_${tool}.zip`;
      await queue.add('convert', { jobId, tool, batch: true, items: inputItems, outputKey: batchOutputKey, settings }, { jobId });
      console.log(JSON.stringify({ type: 'job_created', jobId, tool, batch: true, count: inputItems.length }));
      return res.json({ jobId });
    }

    const file = files[0];
    const safeName = sanitizeFileName(file.originalname || 'input');
    const inputKey = `inputs/${jobId}/${safeName}`;

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

    await queue.add('convert', { jobId, tool, inputKey, outputKey, originalName: safeName, settings }, { jobId });
    console.log(JSON.stringify({ type: 'job_created', jobId, tool, batch: false, count: 1 }));

    res.json({ jobId });
  } catch (err) {
    console.error(err);
    console.log(JSON.stringify({ type: 'job_error', error: err.message || 'unknown' }));
    res.status(500).json({ error: 'Failed to create job' });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState();
    const progress = job.progress || 0;
    let downloadUrl = null;

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

    res.json({ status: state, progress, downloadUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
