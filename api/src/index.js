const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const sharp = require('sharp');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { customAlphabet } = require('nanoid');
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
const SERVERLESS_RUNTIME = ['1', 'true', 'yes', 'on'].includes(String(process.env.MEGACONVERT_SERVERLESS || '').trim().toLowerCase())
  || Boolean(process.env.VERCEL)
  || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_ROOT_DIR = String(
  process.env.DATA_ROOT_DIR
  || (SERVERLESS_RUNTIME ? path.join('/tmp', 'megaconvert-data') : path.join(__dirname, '..', 'data'))
).trim() || (SERVERLESS_RUNTIME ? path.join('/tmp', 'megaconvert-data') : path.join(__dirname, '..', 'data'));

const app = express();
app.set('etag', false);
app.set('trust proxy', true);
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
const allowAllHttpsOrigins = String(process.env.ALLOW_ALL_HTTPS_ORIGINS || 'false').toLowerCase() === 'true';

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
const rawSecurityHeadersEnabled = String(process.env.SECURITY_HEADERS_ENABLED || 'true').trim().toLowerCase();
const rawHstsEnabled = String(process.env.HSTS_ENABLED || 'true').trim().toLowerCase();
const SECURITY_HEADERS_ENABLED = !['0', 'false', 'no', 'off', 'disabled'].includes(rawSecurityHeadersEnabled);
const HSTS_ENABLED = !['0', 'false', 'no', 'off', 'disabled'].includes(rawHstsEnabled);
const HSTS_MAX_AGE = Math.max(300, Number(process.env.HSTS_MAX_AGE || 31536000));
app.use((req, res, next) => {
  if (!SECURITY_HEADERS_ENABLED) return next();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (HSTS_ENABLED && (req.secure || proto === 'https')) {
    res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`);
  }
  next();
});
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
const MAX_FILE_SIZE_MB = Math.max(1, Number(process.env.MAX_FILE_SIZE_MB || 50));
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const BATCH_WATERMARK_MAX_FILES = Math.min(50, Math.max(1, Number(process.env.BATCH_WATERMARK_MAX_FILES || 50)));
const BATCH_WATERMARK_TEXT_MAX_LEN = Math.max(8, Number(process.env.BATCH_WATERMARK_TEXT_MAX_LEN || 64));
const BATCH_WATERMARK_FONT_BASE = Math.max(12, Number(process.env.BATCH_WATERMARK_FONT_BASE || 36));
const BATCH_WATERMARK_PADDING_BASE = Math.max(8, Number(process.env.BATCH_WATERMARK_PADDING_BASE || 28));
const BATCH_WATERMARK_TMP_DIR = String(
  process.env.BATCH_WATERMARK_TMP_DIR || path.join(DATA_ROOT_DIR, 'tmp', 'batch-watermark')
).trim() || path.join(DATA_ROOT_DIR, 'tmp', 'batch-watermark');
const RATE_LIMIT_UPLOADS_PER_MIN = Number(process.env.RATE_LIMIT_UPLOADS_PER_MIN || 30);
const RATE_LIMIT_JOBS_PER_MIN = Number(process.env.RATE_LIMIT_JOBS_PER_MIN || 20);
const RATE_LIMIT_CONVERSIONS_PER_HOUR = Math.max(1, Number(process.env.RATE_LIMIT_CONVERSIONS_PER_HOUR || 10));
const JOB_IDEMPOTENCY_KEY_MAX_LEN = Math.max(16, Number(process.env.JOB_IDEMPOTENCY_KEY_MAX_LEN || 128));
const JOB_IDEMPOTENCY_TTL_SEC = Math.max(60, Number(process.env.JOB_IDEMPOTENCY_TTL_SEC || 24 * 60 * 60));
const JOB_DEDUPE_TTL_SEC = Math.max(60, Number(process.env.JOB_DEDUPE_TTL_SEC || 30 * 60));
const JOB_EVENTS_POLL_INTERVAL_MS = Math.max(250, Number(process.env.JOB_EVENTS_POLL_INTERVAL_MS || 1000));
const UPLOAD_HASH_CACHE_TTL_SEC = Math.max(60, Number(process.env.UPLOAD_HASH_CACHE_TTL_SEC || 7 * 24 * 60 * 60));
const UPLOAD_HASH_COMPUTE_MAX_BYTES = Math.max(1, Number(process.env.UPLOAD_HASH_COMPUTE_MAX_BYTES || 100 * 1024 * 1024));
const AUTOSCALER_MIN_WORKERS = Math.max(1, Number(process.env.AUTOSCALER_MIN_WORKERS || 1));
const AUTOSCALER_MAX_WORKERS = Math.max(AUTOSCALER_MIN_WORKERS, Number(process.env.AUTOSCALER_MAX_WORKERS || 20));
const AUTOSCALER_TARGET_BACKLOG_PER_WORKER = Math.max(1, Number(process.env.AUTOSCALER_TARGET_BACKLOG_PER_WORKER || 4));
const AUTOSCALER_TARGET_ACTIVE_PER_WORKER = Math.max(1, Number(process.env.AUTOSCALER_TARGET_ACTIVE_PER_WORKER || 2));
const ZK_SESSION_TTL_SEC = Number(process.env.ZK_SESSION_TTL_SEC || 180);
const ENCRYPTION_KEY_VERSION = String(process.env.ENCRYPTION_KEY_VERSION || 'v1').trim() || 'v1';
const ENCRYPTION_MIN_CHUNK_SIZE = Math.max(16 * 1024, Number(process.env.ENCRYPTION_MIN_CHUNK_SIZE || 64 * 1024));
const ENCRYPTION_MAX_CHUNK_SIZE = Math.max(ENCRYPTION_MIN_CHUNK_SIZE, Number(process.env.ENCRYPTION_MAX_CHUNK_SIZE || 16 * 1024 * 1024));
const ENCRYPTION_MAX_TOTAL_CHUNKS = Math.max(1, Number(process.env.ENCRYPTION_MAX_TOTAL_CHUNKS || 20000));
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
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama3-8b-8192').trim() || 'llama3-8b-8192';
const GROQ_TIMEOUT_MS = Math.max(1000, Number(process.env.GROQ_TIMEOUT_MS || 15000));
const AI_PARSE_INTENT_SYSTEM_PROMPT = 'Ты — умный маршрутизатор для сервиса конвертации файлов. Тебе на вход дают текст пользователя. Твоя задача — извлечь исходный формат файла (from) и желаемый формат конвертации (to). Ты ДОЛЖЕН отвечать ТОЛЬКО валидным JSON без markdown-разметки, без приветствий и без объяснений. Структура ответа строго такая: {"intent": "convert", "from": "pdf", "to": "docx"}. Если какой-то формат не ясен, пиши null.';
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
  process.env.ANALYTICS_FALLBACK_FILE || path.join(DATA_ROOT_DIR, 'analytics_events_fallback.jsonl')
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
  process.env.ADMIN_POSTS_FILE || path.join(DATA_ROOT_DIR, 'admin_posts.json')
).trim();
const DEVELOPERS_FILE = String(
  process.env.DEVELOPERS_FILE || path.join(DATA_ROOT_DIR, 'developers.json')
).trim();
const POST_LIKES_FILE = String(
  process.env.POST_LIKES_FILE || path.join(DATA_ROOT_DIR, 'post_likes.json')
).trim();
const CONTENT_PAGES_FILE = String(
  process.env.CONTENT_PAGES_FILE || path.join(DATA_ROOT_DIR, 'content_pages.json')
).trim();
const CONTENT_BLOCKS_FILE = String(
  process.env.CONTENT_BLOCKS_FILE || path.join(DATA_ROOT_DIR, 'content_blocks.json')
).trim();
const PLATFORM_SETTINGS_FILE = String(
  process.env.PLATFORM_SETTINGS_FILE || path.join(DATA_ROOT_DIR, 'platform_settings.json')
).trim();
const API_KEYS_FILE = String(
  process.env.API_KEYS_FILE || path.join(DATA_ROOT_DIR, 'api_keys.json')
).trim();
const API_USAGE_FILE = String(
  process.env.API_USAGE_FILE || path.join(DATA_ROOT_DIR, 'api_usage.json')
).trim();
const API_WEBHOOKS_FILE = String(
  process.env.API_WEBHOOKS_FILE || path.join(DATA_ROOT_DIR, 'api_webhooks.json')
).trim();
const API_WEBHOOK_DELIVERIES_FILE = String(
  process.env.API_WEBHOOK_DELIVERIES_FILE || path.join(DATA_ROOT_DIR, 'api_webhook_deliveries.json')
).trim();
const SHARE_LINKS_FILE = String(
  process.env.SHARE_LINKS_FILE || path.join(DATA_ROOT_DIR, 'share_links.json')
).trim();
const AUDIT_LOGS_FILE = String(
  process.env.AUDIT_LOGS_FILE || path.join(DATA_ROOT_DIR, 'audit_logs.json')
).trim();
const LOCALIZATION_OVERRIDES_FILE = String(
  process.env.LOCALIZATION_OVERRIDES_FILE || path.join(DATA_ROOT_DIR, 'localization_overrides.json')
).trim();
const WORKER_HEALTH_CHECKS_FILE = String(
  process.env.WORKER_HEALTH_CHECKS_FILE || path.join(DATA_ROOT_DIR, 'worker_health_checks.json')
).trim();
const SYNTHETIC_TEST_RESULTS_FILE = String(
  process.env.SYNTHETIC_TEST_RESULTS_FILE || path.join(DATA_ROOT_DIR, 'synthetic_test_results.json')
).trim();
const FORMAT_HEALTH_STATE_FILE = String(
  process.env.FORMAT_HEALTH_STATE_FILE || path.join(DATA_ROOT_DIR, 'format_health_state.json')
).trim();
const WORKER_ALERT_EVENTS_FILE = String(
  process.env.WORKER_ALERT_EVENTS_FILE || path.join(DATA_ROOT_DIR, 'worker_alert_events.json')
).trim();
const WORKER_JOB_RESULTS_FILE = String(
  process.env.WORKER_JOB_RESULTS_FILE || path.join(DATA_ROOT_DIR, 'worker_job_results.json')
).trim();
const WORKSPACE_PLATFORM_FILE = String(
  process.env.WORKSPACE_PLATFORM_FILE || path.join(DATA_ROOT_DIR, 'workspace_platform.json')
).trim();
const ACCOUNT_FALLBACK_FILE = String(
  process.env.ACCOUNT_FALLBACK_FILE || path.join(DATA_ROOT_DIR, 'account_fallback.json')
).trim();
const ADMIN_ASSETS_DIR = String(
  process.env.ADMIN_ASSETS_DIR || path.join(DATA_ROOT_DIR, 'admin_assets')
).trim();
const ADMIN_ASSET_IMAGE_MAX_BYTES = Math.max(64 * 1024, Number(process.env.ADMIN_ASSET_IMAGE_MAX_BYTES || 5 * 1024 * 1024));
const FRONTEND_I18N_DIR = String(
  process.env.FRONTEND_I18N_DIR || path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n')
).trim();
const ADMIN_DEFAULT_ROLE = String(process.env.ADMIN_DEFAULT_ROLE || 'super_admin').trim().toLowerCase() || 'super_admin';
const ADMIN_POST_STATUSES = new Set(['draft', 'published', 'archived']);
const ADMIN_POST_TITLE_MAX_LEN = Math.max(32, Number(process.env.ADMIN_POST_TITLE_MAX_LEN || 160));
const ADMIN_POST_EXCERPT_MAX_LEN = Math.max(64, Number(process.env.ADMIN_POST_EXCERPT_MAX_LEN || 280));
const ADMIN_POST_CONTENT_MAX_LEN = Math.max(256, Number(process.env.ADMIN_POST_CONTENT_MAX_LEN || 200000));
const DEVELOPER_NAME_MAX_LEN = Math.max(32, Number(process.env.DEVELOPER_NAME_MAX_LEN || 120));
const DEVELOPER_ROLE_MAX_LEN = Math.max(16, Number(process.env.DEVELOPER_ROLE_MAX_LEN || 120));
const DEVELOPER_BIO_MAX_LEN = Math.max(64, Number(process.env.DEVELOPER_BIO_MAX_LEN || 500));
const POST_LIKE_RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.POST_LIKE_RATE_LIMIT_PER_MIN || 10));
const PROMO_CODE_ALLOWED = /^[A-Z0-9][A-Z0-9_-]*$/;
const PROMO_BENEFIT_TYPES = new Set(['percent_discount', 'trial_days', 'lifetime_access', 'credits', 'feature_access']);
const ACCOUNT_BLOCK_FEATURE_TOKENS = new Set([
  'account_block',
  'account_blocked',
  'account_blocked_forever',
  'blocked_forever',
  'ban_account',
  'banned'
]);
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
const ACCOUNT_STORAGE_FALLBACK_ENABLED = parseEnvBoolean(process.env.ACCOUNT_STORAGE_FALLBACK_ENABLED, true);
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
const API_KEY_DEFAULT_PREFIX = String(process.env.API_KEY_PREFIX || 'mk_live_').trim() || 'mk_live_';
const API_KEY_MAX_PER_USER = Math.max(1, Number(process.env.API_KEY_MAX_PER_USER || 20));
const API_USAGE_MAX_ROWS = Math.max(1000, Number(process.env.API_USAGE_MAX_ROWS || 200000));
const API_WEBHOOKS_MAX_PER_KEY = Math.max(1, Number(process.env.API_WEBHOOKS_MAX_PER_KEY || 20));
const API_WEBHOOK_DELIVERY_LIST_LIMIT = Math.max(10, Number(process.env.API_WEBHOOK_DELIVERY_LIST_LIMIT || 200));
const API_WEBHOOK_TIMEOUT_MS = Math.max(1000, Number(process.env.API_WEBHOOK_TIMEOUT_MS || 8000));
const INTERNAL_WORKER_TOKEN = String(process.env.INTERNAL_WORKER_TOKEN || process.env.WORKER_INTERNAL_TOKEN || '').trim();
const WORKER_HEALTH_MAX_ROWS = Math.max(100, Number(process.env.WORKER_HEALTH_MAX_ROWS || 10000));
const SYNTHETIC_RESULTS_MAX_ROWS = Math.max(100, Number(process.env.SYNTHETIC_RESULTS_MAX_ROWS || 10000));
const WORKER_ALERT_MAX_ROWS = Math.max(100, Number(process.env.WORKER_ALERT_MAX_ROWS || 5000));
const WORKER_JOB_RESULTS_MAX_ROWS = Math.max(1000, Number(process.env.WORKER_JOB_RESULTS_MAX_ROWS || 200000));
const WORKSPACE_PLATFORM_MAX_ROWS = Math.max(1000, Number(process.env.WORKSPACE_PLATFORM_MAX_ROWS || 200000));
const SYNTHETIC_ALERT_WINDOW = Math.max(5, Number(process.env.SYNTHETIC_ALERT_WINDOW || 20));
const SYNTHETIC_SUCCESS_RATE_THRESHOLD = Math.max(0.5, Math.min(1, Number(process.env.SYNTHETIC_SUCCESS_RATE_THRESHOLD || 0.95)));
const SYNTHETIC_LATENCY_THRESHOLD_MS = Math.max(100, Number(process.env.SYNTHETIC_LATENCY_THRESHOLD_MS || 20000));
const FORMAT_FAILURE_DISABLE_STREAK = Math.max(1, Number(process.env.FORMAT_FAILURE_DISABLE_STREAK || 3));
const ADMIN_ALLOW_INSECURE_NO_AUTH = parseEnvBoolean(process.env.ADMIN_ALLOW_INSECURE_NO_AUTH, false);
const API_KEY_PLAN_LIMITS = {
  free: { rate_limit_per_min: 60, quota_monthly: 5000 },
  pro: { rate_limit_per_min: 300, quota_monthly: 100000 },
  enterprise: { rate_limit_per_min: 1200, quota_monthly: 1000000 }
};
const BOT_INTERNAL_API_BASE = String(process.env.BOT_INTERNAL_API_BASE || '').trim().replace(/\/+$/, '');
const BOT_INTERNAL_LINK_SECRET = String(
  process.env.BOT_INTERNAL_LINK_SECRET || process.env.INTERNAL_LINK_SECRET || ''
).trim();
const ACCOUNT_BLOCK_CACHE_TTL_MS = Math.max(1000, Number(process.env.ACCOUNT_BLOCK_CACHE_TTL_MS || 10000));
const TEST_MODE_ENABLED = parseEnvBoolean(process.env.TEST_MODE_ENABLED, false);
const TEST_MODE_PASSWORD = String(process.env.TEST_MODE_PASSWORD || '').trim();
const TEST_MODE_USER_PREFIX = (
  String(process.env.TEST_MODE_USER_PREFIX || 'testmode')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  || 'testmode'
);
const TEST_MODE_PLAN_TIER = String(process.env.TEST_MODE_PLAN_TIER || 'team').trim().toLowerCase() || 'team';
const TEST_MODE_ALLOW_REMOTE = parseEnvBoolean(process.env.TEST_MODE_ALLOW_REMOTE, false);
const TEST_MODE_ALIAS_MAX_LEN = Math.max(8, Number(process.env.TEST_MODE_ALIAS_MAX_LEN || 64));

const twofaCodes = new Map(); // email -> { code, expiresAt }
const twofaTokens = new Map(); // token -> { email, expiresAt }
let redisReady = false;
let lastRedisError = null;
let bucketReady = false;
let analyticsFlushTimer = null;
let shareCleanupTimer = null;
let analyticsFlushInFlight = false;
const analyticsBuffer = [];
let analyticsFallbackWriteQueue = Promise.resolve();
let adminPostsStore = null;
let developersStore = null;
let postLikesStore = null;
let contentPagesStore = null;
let contentBlocksStore = null;
let platformSettingsStore = null;
let apiKeysStore = null;
let apiUsageStore = null;
let apiWebhooksStore = null;
let apiWebhookDeliveriesStore = null;
let shareLinksStore = null;
let auditLogsStore = null;
let localizationOverridesStore = null;
let workerHealthChecksStore = null;
let syntheticTestResultsStore = null;
let formatHealthStateStore = null;
let workerAlertEventsStore = null;
let workerJobResultsStore = null;
let workspacePlatformStore = null;
let accountFallbackStore = null;
const accountBlockStateCache = new Map();
let postLikesMutationQueue = Promise.resolve();
let pgPool = null;
let pgModuleLoadAttempted = false;
let pgPoolInitError = null;
let workerHeartbeatAt = 0;
const opsCounters = {
  eventsAccepted: 0,
  workerPings: 0
};
const SHARE_EXPIRY_PRESETS = {
  one_hour: 60 * 60,
  one_day: 24 * 60 * 60,
  seven_days: 7 * 24 * 60 * 60,
  thirty_days: 30 * 24 * 60 * 60,
  never: 0
};
const SHARE_TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHARE_TOKEN_LENGTH = Math.max(6, Number(process.env.SHARE_TOKEN_LENGTH || 8));
const SHARE_CLEANUP_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.SHARE_CLEANUP_INTERVAL_MS || 10 * 60 * 1000));
const createNanoShareId = customAlphabet(SHARE_TOKEN_ALPHABET, SHARE_TOKEN_LENGTH);

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
const isBase64Text = (value) => /^[A-Za-z0-9+/=]+$/.test(String(value || '').trim());

function validateEncryptionMeta(meta) {
  const src = meta && typeof meta === 'object' ? meta : {};
  const chunkSize = Number(src.chunkSize || 0);
  const totalChunks = Number(src.totalChunks || 0);
  const ivBase = String(src.ivBase || '').trim();
  const alg = String(src.alg || 'AES-256-GCM').trim().toUpperCase();
  if (alg !== 'AES-256-GCM') {
    return { ok: false, code: 'INVALID_ENCRYPTION_ALG', message: 'Unsupported encryption algorithm' };
  }
  if (!Number.isInteger(chunkSize) || chunkSize < ENCRYPTION_MIN_CHUNK_SIZE || chunkSize > ENCRYPTION_MAX_CHUNK_SIZE) {
    return { ok: false, code: 'INVALID_ENCRYPTION_CHUNK', message: 'Invalid encryption chunk size' };
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > ENCRYPTION_MAX_TOTAL_CHUNKS) {
    return { ok: false, code: 'INVALID_ENCRYPTION_CHUNKS', message: 'Invalid encryption chunks count' };
  }
  if (!ivBase || !isBase64Text(ivBase)) {
    return { ok: false, code: 'INVALID_ENCRYPTION_IV', message: 'Invalid encryption ivBase' };
  }
  let ivBytes = null;
  try {
    ivBytes = Buffer.from(ivBase, 'base64');
  } catch {
    return { ok: false, code: 'INVALID_ENCRYPTION_IV', message: 'Invalid encryption ivBase' };
  }
  if (!ivBytes || ivBytes.length !== 8) {
    return { ok: false, code: 'INVALID_ENCRYPTION_IV', message: 'Invalid encryption ivBase length' };
  }
  return { ok: true };
}

function validateEncryptionEnvelope(encryption, { requireKeyWrap = false } = {}) {
  if (!encryption || encryption.enabled !== true) return { ok: true };
  const keyWrap = encryption.keyWrap && typeof encryption.keyWrap === 'object' ? encryption.keyWrap : null;
  if (requireKeyWrap) {
    if (!keyWrap) return { ok: false, code: 'MISSING_KEY_WRAP', message: 'Missing key wrapping metadata' };
    const wrappedKey = String(keyWrap.wrappedKey || '').trim();
    const nonce = String(keyWrap.nonce || '').trim();
    const clientPublicKey = String(keyWrap.clientPublicKey || '').trim();
    if (!wrappedKey || !nonce || !clientPublicKey) {
      return { ok: false, code: 'MISSING_KEY_WRAP', message: 'Incomplete key wrapping metadata' };
    }
    if (!isBase64Text(wrappedKey) || !isBase64Text(nonce) || !isBase64Text(clientPublicKey)) {
      return { ok: false, code: 'INVALID_KEY_WRAP', message: 'Invalid key wrapping metadata' };
    }
  }
  return { ok: true };
}

async function rateLimit(key, limit, windowSec) {
  const count = await withTimeout(connection.incr(key), REDIS_OP_TIMEOUT_MS, 'redis_incr_timeout');
  if (count === 1) {
    await withTimeout(connection.expire(key, windowSec), REDIS_OP_TIMEOUT_MS, 'redis_expire_timeout');
  }
  return count <= limit;
}

const fileTooLargePayload = (requestId) => ({
  status: 'error',
  code: 'FILE_TOO_LARGE',
  message: `File exceeds ${MAX_FILE_SIZE_MB}MB limit`,
  requestId
});

const BATCH_WATERMARK_ALLOWED_POSITIONS = new Set(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
const BATCH_WATERMARK_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif'
]);
const BATCH_WATERMARK_EXT_TO_FORMAT = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'png',
  tif: 'tiff',
  tiff: 'tiff',
  avif: 'avif'
};
const BATCH_WATERMARK_EXT_BY_FORMAT = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  tiff: 'tiff',
  avif: 'avif'
};

const ensureBatchWatermarkTmpDir = async () => {
  await fs.promises.mkdir(BATCH_WATERMARK_TMP_DIR, { recursive: true });
};

const stripHexColor = (value) => String(value || '').trim().replace(/^#/, '');

const normalizeWatermarkColor = (value) => {
  const normalized = stripHexColor(value);
  if (/^[\da-f]{3}$/i.test(normalized)) {
    const expanded = normalized.split('').map((ch) => `${ch}${ch}`).join('');
    return `#${expanded.toLowerCase()}`;
  }
  if (/^[\da-f]{6}$/i.test(normalized)) return `#${normalized.toLowerCase()}`;
  return '#ffffff';
};

const normalizeWatermarkPosition = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return BATCH_WATERMARK_ALLOWED_POSITIONS.has(normalized) ? normalized : 'center';
};

const inferImageExtFromName = (name) => {
  const ext = String(path.extname(String(name || '')).replace('.', '')).trim().toLowerCase();
  return ext || '';
};

const resolveWatermarkOutputFormat = (mimeType, originalName) => {
  const mime = String(mimeType || '').trim().toLowerCase();
  const byMime = mime.startsWith('image/') ? mime.split('/')[1] : '';
  const raw = byMime || inferImageExtFromName(originalName);
  const normalized = BATCH_WATERMARK_EXT_TO_FORMAT[raw] || raw;
  if (BATCH_WATERMARK_EXT_BY_FORMAT[normalized]) return normalized;
  return 'png';
};

const getWatermarkOutputName = (originalName, outputFormat, index = 0) => {
  const parsed = path.parse(sanitizeFileName(String(originalName || `image-${index + 1}`)));
  const base = String(parsed.name || `image-${index + 1}`).replace(/[^\w.-]+/g, '_') || `image-${index + 1}`;
  const ext = BATCH_WATERMARK_EXT_BY_FORMAT[outputFormat] || 'png';
  return `${base}.${ext}`;
};

const applySharpOutputFormat = (pipeline, outputFormat) => {
  if (outputFormat === 'jpeg') return pipeline.jpeg({ quality: 92, mozjpeg: true });
  if (outputFormat === 'webp') return pipeline.webp({ quality: 90 });
  if (outputFormat === 'png') return pipeline.png({ compressionLevel: 9 });
  if (outputFormat === 'tiff') return pipeline.tiff({ quality: 90 });
  if (outputFormat === 'gif') return pipeline.gif();
  if (outputFormat === 'avif') return pipeline.avif({ quality: 55 });
  return pipeline.png({ compressionLevel: 9 });
};

const escapeSvgText = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const resolveWatermarkPlacement = ({ width, height, padding, position }) => {
  const safeWidth = Math.max(1, Number(width || 1));
  const safeHeight = Math.max(1, Number(height || 1));
  const safePadding = Math.max(6, Number(padding || 6));
  if (position === 'top-left') return { x: safePadding, y: safePadding, anchor: 'start', baseline: 'hanging' };
  if (position === 'top-right') return { x: Math.max(safePadding, safeWidth - safePadding), y: safePadding, anchor: 'end', baseline: 'hanging' };
  if (position === 'bottom-left') return { x: safePadding, y: Math.max(safePadding, safeHeight - safePadding), anchor: 'start', baseline: 'baseline' };
  if (position === 'bottom-right') return { x: Math.max(safePadding, safeWidth - safePadding), y: Math.max(safePadding, safeHeight - safePadding), anchor: 'end', baseline: 'baseline' };
  return {
    x: Math.floor(safeWidth / 2),
    y: Math.floor(safeHeight / 2),
    anchor: 'middle',
    baseline: 'middle'
  };
};

const buildTextWatermarkSvg = ({ width, height, text, color, position }) => {
  const safeWidth = Math.max(1, Number(width || 1));
  const safeHeight = Math.max(1, Number(height || 1));
  const baseFont = Math.max(12, Number(BATCH_WATERMARK_FONT_BASE || 36));
  const fontSize = Math.max(12, Math.round(Math.min(baseFont, Math.min(safeWidth, safeHeight) * 0.085)));
  const padding = Math.max(8, Math.round(Math.min(BATCH_WATERMARK_PADDING_BASE, Math.min(safeWidth, safeHeight) * 0.06)));
  const placement = resolveWatermarkPlacement({ width: safeWidth, height: safeHeight, padding, position });
  const escapedText = escapeSvgText(String(text || '').slice(0, BATCH_WATERMARK_TEXT_MAX_LEN));
  const safeColor = normalizeWatermarkColor(color);
  const shadowSize = Math.max(1, Math.round(fontSize * 0.08));
  return `<svg width="${safeWidth}" height="${safeHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="${shadowSize}" stdDeviation="${shadowSize}" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
    </defs>
    <text
      x="${placement.x}"
      y="${placement.y}"
      text-anchor="${placement.anchor}"
      dominant-baseline="${placement.baseline}"
      font-family="SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
      font-size="${fontSize}"
      font-weight="600"
      letter-spacing="0.4"
      fill="${safeColor}"
      fill-opacity="0.8"
      filter="url(#textShadow)"
      style="paint-order: stroke; stroke: rgba(0,0,0,0.35); stroke-width: ${Math.max(1, Math.round(fontSize * 0.06))}; stroke-linejoin: round;"
      >
      <tspan x="${placement.x}" dy="0">${escapedText}</tspan>
    </text>
  </svg>`;
};

const removeUploadedFiles = async (files) => {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return;
  await Promise.allSettled(list.map(async (file) => {
    const filePath = String(file?.path || '').trim();
    if (!filePath) return;
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // ignore cleanup errors
    }
  }));
};

const batchWatermarkUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      void ensureBatchWatermarkTmpDir()
        .then(() => cb(null, BATCH_WATERMARK_TMP_DIR))
        .catch((error) => cb(error));
    },
    filename(req, file, cb) {
      const safeName = sanitizeFileName(String(file?.originalname || 'image'));
      const token = crypto.randomBytes(6).toString('hex');
      cb(null, `${Date.now()}-${token}-${safeName}`);
    }
  }),
  limits: {
    files: BATCH_WATERMARK_MAX_FILES,
    fileSize: MAX_FILE_SIZE
  },
  fileFilter(req, file, cb) {
    const mime = String(file?.mimetype || '').trim().toLowerCase();
    const ext = inferImageExtFromName(file?.originalname);
    if (BATCH_WATERMARK_ALLOWED_MIME.has(mime) || Boolean(BATCH_WATERMARK_EXT_TO_FORMAT[ext])) {
      return cb(null, true);
    }
    return cb(new Error('UNSUPPORTED_IMAGE_FORMAT'));
  }
});

const shareUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_FILE_SIZE
  }
});

const conversionRateLimitMiddleware = async (req, res, next) => {
  try {
    if (isUnlimitedTestRequest(req)) return next();
    const clientId = getClientId(req);
    const allowed = await rateLimit(`rl:convert_hour:${clientId}`, RATE_LIMIT_CONVERSIONS_PER_HOUR, 60 * 60);
    if (!allowed) {
      return res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_HOURLY',
        message: `Too many conversion requests. Limit is ${RATE_LIMIT_CONVERSIONS_PER_HOUR} per hour.`,
        requestId: req.requestId
      });
    }
    return next();
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'redis_unavailable'));
    }
    logError({
      type: 'conversion_rate_limit_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'RATE_LIMIT_CHECK_FAILED',
      message: 'Failed to validate rate limit',
      requestId: req.requestId
    });
  }
};

function getClientId(req) {
  const ip = getRequestIp(req);
  const userId = req.headers['x-user-id'];
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function getRequestIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function normalizeJobProgressPayload(rawProgress) {
  const toProgressNumber = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, numeric));
  };

  if (Array.isArray(rawProgress)) {
    const itemProgress = rawProgress;
    const values = itemProgress
      .map((entry) => {
        if (typeof entry === 'number') return toProgressNumber(entry);
        if (entry && typeof entry === 'object') {
          return toProgressNumber(entry.progress || entry.pct || entry.value || 0);
        }
        return 0;
      })
      .filter((value) => Number.isFinite(value));
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return { progress: toProgressNumber(average), itemProgress };
  }

  if (rawProgress && typeof rawProgress === 'object') {
    const progress = toProgressNumber(rawProgress.progress || rawProgress.overall || rawProgress.percent || 0);
    const itemProgress = Array.isArray(rawProgress.items)
      ? rawProgress.items
      : (Array.isArray(rawProgress.itemProgress) ? rawProgress.itemProgress : null);
    return { progress, itemProgress };
  }

  return { progress: toProgressNumber(rawProgress), itemProgress: null };
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

function requireAdminAuthIfEnabled(req, res, next) {
  if (!ADMIN_AUTH_ENABLED) {
    if (!ADMIN_ALLOW_INSECURE_NO_AUTH) {
      return res.status(503).json({
        status: 'error',
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin auth is not configured',
        requestId: req.requestId
      });
    }
    req.admin = {
      sub: 'admin',
      role: ADMIN_DEFAULT_ROLE || 'super_admin',
      sid: null,
      mode: 'auth_disabled_insecure'
    };
    return next();
  }
  return requireAdminAuth(req, res, next);
}

function getRequestUserId(req) {
  const raw = req.headers['x-user-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim();
}

function sanitizeTestModeAlias(rawValue) {
  const raw = String(rawValue || '').trim().toLowerCase();
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
  const cleaned = localPart
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, TEST_MODE_ALIAS_MAX_LEN);
  return cleaned;
}

function buildTestModeUserId(rawAlias = '') {
  const alias = sanitizeTestModeAlias(rawAlias);
  const suffix = alias || crypto.randomBytes(6).toString('hex');
  return `${TEST_MODE_USER_PREFIX}_${suffix}`;
}

function getRequestHost(req) {
  const rawHost = req.headers.host;
  const hostValue = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const host = String(hostValue || '').trim().toLowerCase();
  return host.split(':')[0] || '';
}

function isLoopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isTestModeConfigured() {
  return TEST_MODE_ENABLED && Boolean(TEST_MODE_PASSWORD);
}

function isTestModeRequestAllowed(req) {
  if (!isTestModeConfigured()) return false;
  if (TEST_MODE_ALLOW_REMOTE) return true;
  return isLoopbackHost(getRequestHost(req));
}

function isTestModeUserId(rawUserId) {
  const normalized = String(rawUserId || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.startsWith(`${TEST_MODE_USER_PREFIX}_`);
}

function isUnlimitedTestRequest(req) {
  return isTestModeUserId(getRequestUserId(req));
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

function requireInternalWorkerAuth(req, res, next) {
  if (!INTERNAL_WORKER_TOKEN) {
    return next();
  }
  const header = String(req.headers['x-worker-token'] || '').trim();
  if (!header || header !== INTERNAL_WORKER_TOKEN) {
    return res.status(401).json({
      status: 'error',
      code: 'WORKER_UNAUTHORIZED',
      message: 'Worker auth failed',
      requestId: req.requestId
    });
  }
  return next();
}

function resolveToolAvailability(toolId) {
  const tool = String(toolId || '').trim();
  const state = loadFormatHealthStateStore();
  const item = asObject(state[tool]);
  if (!item.disabled) {
    return { allowed: true, tool, fallback_applied: false, reason: null };
  }
  const fallback = String(item.fallback_tool || '').trim();
  if (fallback && TOOL_IDS.has(fallback)) {
    return {
      allowed: true,
      tool: fallback,
      fallback_applied: true,
      reason: String(item.reason || '').trim() || 'Tool disabled, fallback applied'
    };
  }
  return {
    allowed: false,
    tool,
    fallback_applied: false,
    reason: String(item.reason || '').trim() || 'Tool temporarily disabled'
  };
}

function extractApiKeyFromRequest(req) {
  const authHeaderRaw = req.headers.authorization;
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
  const value = String(authHeader || '').trim();
  if (value.toLowerCase().startsWith('bearer ')) {
    return value.slice(7).trim();
  }
  const xApiKeyRaw = req.headers['x-api-key'];
  if (Array.isArray(xApiKeyRaw)) return String(xApiKeyRaw[0] || '').trim();
  return String(xApiKeyRaw || '').trim();
}

function requireApiKeyAuth(req, res, next) {
  const token = extractApiKeyFromRequest(req);
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'API_KEY_REQUIRED',
      message: 'Missing API key',
      requestId: req.requestId
    });
  }
  const item = getApiKeyByToken(token);
  if (!item) {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_API_KEY',
      message: 'Invalid API key',
      requestId: req.requestId
    });
  }
  if (item.revoked_at) {
    return res.status(401).json({
      status: 'error',
      code: 'API_KEY_REVOKED',
      message: 'API key revoked',
      requestId: req.requestId
    });
  }
  if (item.expires_at && Date.now() > Date.parse(item.expires_at)) {
    return res.status(401).json({
      status: 'error',
      code: 'API_KEY_EXPIRED',
      message: 'API key expired',
      requestId: req.requestId
    });
  }

  const limits = resolveApiKeyLimits(item.plan, item);
  const allowedIps = sanitizeIpAllowlist(item.allowed_ips);
  const requestIp = getRequestIp(req);
  if (allowedIps.length > 0 && !allowedIps.includes(requestIp)) {
    return res.status(403).json({
      status: 'error',
      code: 'API_IP_NOT_ALLOWED',
      message: 'IP is not allowed for this API key',
      requestId: req.requestId
    });
  }
  req.apiKey = {
    ...item,
    ...limits,
    allowed_ips: allowedIps
  };
  req.apiKeyToken = token;
  return next();
}

async function enforceApiKeyLimits(req, res, next) {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) return res.status(503).json(redis.payload);

    const apiKey = req.apiKey;
    const minuteBucket = Math.floor(Date.now() / 60000);
    const redisKey = `rl:apikey:${apiKey.id}:${minuteBucket}`;
    const allowed = await rateLimit(redisKey, apiKey.rate_limit_per_min, 60);
    if (!allowed) {
      return res.status(429).json({
        status: 'error',
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        requestId: req.requestId
      });
    }
    const monthId = monthIdFromDate();
    const usageCount = getApiKeyMonthlyUsageCount(apiKey.id, monthId);
    if (usageCount >= apiKey.quota_monthly) {
      return res.status(429).json({
        status: 'error',
        code: 'API_QUOTA_EXCEEDED',
        message: 'Monthly quota exceeded',
        requestId: req.requestId
      });
    }
    req.apiKeyUsageMonth = monthId;
    return next();
  } catch (error) {
    logError({ type: 'api_key_limit_enforce_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({
      status: 'error',
      code: 'API_KEY_LIMIT_FAILED',
      message: 'Failed to evaluate API limits',
      requestId: req.requestId
    });
  }
}

function apiKeyUsageTracker(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (!req.apiKey?.id) return;
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === req.apiKey.id);
    if (index >= 0) {
      keys[index] = {
        ...keys[index],
        last_used_at: new Date().toISOString()
      };
      saveApiKeysStore(keys);
    }
    appendApiUsageEvent({
      api_key_id: req.apiKey.id,
      endpoint: req.path,
      status: res.statusCode,
      response_time_ms: Date.now() - startedAt,
      bytes_processed: Number(req.headers['content-length'] || 0),
      created_at: Date.now()
    });
  });
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
    if (ACCOUNT_STORAGE_FALLBACK_ENABLED) {
      return { ok: true, fallback: true };
    }
    return {
      ok: false,
      statusCode: 503,
      code: 'ACCOUNT_STORAGE_NOT_CONFIGURED',
      message: 'Account storage is not configured'
    };
  }
  const pool = getPgPool();
  if (!pool) {
    if (ACCOUNT_STORAGE_FALLBACK_ENABLED) {
      return { ok: true, fallback: true };
    }
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

function sanitizeOptionalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // Allow relative API-proxied asset paths served via the web app origin.
  if (raw.startsWith('/api/admin/assets/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeStoredDeveloper(raw) {
  const value = asObject(raw);
  const nowIso = new Date().toISOString();
  return {
    id: String(value.id || uuidv4()).trim() || uuidv4(),
    name: clampText(String(value.name || '').trim() || 'Unnamed', DEVELOPER_NAME_MAX_LEN),
    role: clampText(String(value.role || '').trim() || 'Engineer', DEVELOPER_ROLE_MAX_LEN),
    bio: clampText(String(value.bio || '').trim(), DEVELOPER_BIO_MAX_LEN),
    avatar_url: sanitizeOptionalUrl(value.avatar_url),
    github_url: sanitizeOptionalUrl(value.github_url),
    linkedin_url: sanitizeOptionalUrl(value.linkedin_url),
    twitter_url: sanitizeOptionalUrl(value.twitter_url),
    website_url: sanitizeOptionalUrl(value.website_url),
    order_index: Number.isFinite(Number(value.order_index)) ? Number(value.order_index) : 0,
    is_active: value.is_active !== false,
    created_at: toIsoOrDefault(value.created_at, nowIso) || nowIso,
    updated_at: toIsoOrDefault(value.updated_at, null)
  };
}

function loadDevelopersStore() {
  if (Array.isArray(developersStore)) return developersStore;
  try {
    if (!fs.existsSync(DEVELOPERS_FILE)) {
      developersStore = [];
      return developersStore;
    }
    const raw = fs.readFileSync(DEVELOPERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      developersStore = [];
      return developersStore;
    }
    developersStore = parsed.map((item) => normalizeStoredDeveloper(item));
    return developersStore;
  } catch (error) {
    logError({
      type: 'developers_load_failed',
      file: DEVELOPERS_FILE,
      error: error?.message || 'unknown'
    });
    developersStore = [];
    return developersStore;
  }
}

function saveDevelopersStore(items) {
  const next = Array.isArray(items) ? items.map((item) => normalizeStoredDeveloper(item)) : [];
  const dir = path.dirname(DEVELOPERS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${DEVELOPERS_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, DEVELOPERS_FILE);
  developersStore = next;
}

function listPublicDevelopers() {
  return loadDevelopersStore()
    .filter((item) => item.is_active !== false)
    .slice()
    .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function safeSlug(input, fallback = 'item') {
  const normalized = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function normalizeContentPage(raw) {
  const value = asObject(raw);
  const nowIso = new Date().toISOString();
  const slug = safeSlug(value.slug || value.title || 'page', 'page');
  return {
    id: String(value.id || uuidv4()).trim() || uuidv4(),
    slug,
    title: clampText(String(value.title || slug).trim(), 140),
    description: clampText(String(value.description || '').trim(), 500),
    order_index: Number.isFinite(Number(value.order_index)) ? Number(value.order_index) : 0,
    is_active: value.is_active !== false,
    created_at: toIsoOrDefault(value.created_at, nowIso) || nowIso,
    updated_at: toIsoOrDefault(value.updated_at, null)
  };
}

function normalizeContentBlock(raw) {
  const value = asObject(raw);
  const nowIso = new Date().toISOString();
  const type = safeSlug(value.type || 'text', 'text');
  const pageSlug = safeSlug(value.page_slug || 'home', 'home');
  const content = asObject(value.content || value.content_json || {});
  return {
    id: String(value.id || uuidv4()).trim() || uuidv4(),
    page_slug: pageSlug,
    type,
    title: clampText(String(value.title || '').trim(), 160),
    content_json: content,
    order_index: Number.isFinite(Number(value.order_index)) ? Number(value.order_index) : 0,
    is_active: value.is_active !== false,
    created_at: toIsoOrDefault(value.created_at, nowIso) || nowIso,
    updated_at: toIsoOrDefault(value.updated_at, null)
  };
}

function defaultPlatformSettings() {
  return {
    feature_flags: {
      ai_recommendations: true,
      batch_upload: true,
      public_api: true,
      smart_auto_convert: true,
      public_share_links: true,
      instant_preview: true,
      transparency_panel: true,
      one_click_best_convert: true
    },
    limits: {
      max_file_mb_free: 250,
      max_file_mb_pro: 2048,
      max_batch_files: 100
    },
    queues: {
      default_priority: 'normal',
      enterprise_priority: 'high'
    },
    ai: {
      enabled: true,
      confidence_threshold: 0.65,
      fallback_mode: 'rules'
    },
    updated_at: new Date().toISOString()
  };
}

function normalizePlatformSettings(raw) {
  const incoming = asObject(raw);
  const base = defaultPlatformSettings();
  return {
    feature_flags: { ...base.feature_flags, ...asObject(incoming.feature_flags) },
    limits: { ...base.limits, ...asObject(incoming.limits) },
    queues: { ...base.queues, ...asObject(incoming.queues) },
    ai: { ...base.ai, ...asObject(incoming.ai) },
    updated_at: toIsoOrDefault(incoming.updated_at, new Date().toISOString()) || new Date().toISOString()
  };
}

function loadContentPagesStore() {
  if (Array.isArray(contentPagesStore)) return contentPagesStore;
  try {
    if (!fs.existsSync(CONTENT_PAGES_FILE)) {
      contentPagesStore = [];
      return contentPagesStore;
    }
    const raw = fs.readFileSync(CONTENT_PAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    contentPagesStore = Array.isArray(parsed) ? parsed.map((item) => normalizeContentPage(item)) : [];
    return contentPagesStore;
  } catch (error) {
    logError({ type: 'content_pages_load_failed', file: CONTENT_PAGES_FILE, error: error?.message || 'unknown' });
    contentPagesStore = [];
    return contentPagesStore;
  }
}

function saveContentPagesStore(items) {
  const next = Array.isArray(items) ? items.map((item) => normalizeContentPage(item)) : [];
  writeJsonAtomic(CONTENT_PAGES_FILE, next);
  contentPagesStore = next;
}

function loadContentBlocksStore() {
  if (Array.isArray(contentBlocksStore)) return contentBlocksStore;
  try {
    if (!fs.existsSync(CONTENT_BLOCKS_FILE)) {
      contentBlocksStore = [];
      return contentBlocksStore;
    }
    const raw = fs.readFileSync(CONTENT_BLOCKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    contentBlocksStore = Array.isArray(parsed) ? parsed.map((item) => normalizeContentBlock(item)) : [];
    return contentBlocksStore;
  } catch (error) {
    logError({ type: 'content_blocks_load_failed', file: CONTENT_BLOCKS_FILE, error: error?.message || 'unknown' });
    contentBlocksStore = [];
    return contentBlocksStore;
  }
}

function saveContentBlocksStore(items) {
  const next = Array.isArray(items) ? items.map((item) => normalizeContentBlock(item)) : [];
  writeJsonAtomic(CONTENT_BLOCKS_FILE, next);
  contentBlocksStore = next;
}

function loadPlatformSettingsStore() {
  if (platformSettingsStore && typeof platformSettingsStore === 'object') return platformSettingsStore;
  try {
    if (!fs.existsSync(PLATFORM_SETTINGS_FILE)) {
      platformSettingsStore = defaultPlatformSettings();
      return platformSettingsStore;
    }
    const raw = fs.readFileSync(PLATFORM_SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    platformSettingsStore = normalizePlatformSettings(parsed);
    return platformSettingsStore;
  } catch (error) {
    logError({ type: 'platform_settings_load_failed', file: PLATFORM_SETTINGS_FILE, error: error?.message || 'unknown' });
    platformSettingsStore = defaultPlatformSettings();
    return platformSettingsStore;
  }
}

function savePlatformSettingsStore(next) {
  const normalized = normalizePlatformSettings(next);
  writeJsonAtomic(PLATFORM_SETTINGS_FILE, normalized);
  platformSettingsStore = normalized;
}

function defaultWorkspacePlatformStore() {
  return {
    workspaces: [],
    projects: [],
    folders: [],
    items: [],
    pipelines: [],
    automation_rules: [],
    comments: [],
    integrations: []
  };
}

function normalizeWorkspacePlatformStore(raw) {
  const src = asObject(raw);
  const base = defaultWorkspacePlatformStore();
  return {
    workspaces: Array.isArray(src.workspaces) ? src.workspaces : base.workspaces,
    projects: Array.isArray(src.projects) ? src.projects : base.projects,
    folders: Array.isArray(src.folders) ? src.folders : base.folders,
    items: Array.isArray(src.items) ? src.items : base.items,
    pipelines: Array.isArray(src.pipelines) ? src.pipelines : base.pipelines,
    automation_rules: Array.isArray(src.automation_rules) ? src.automation_rules : base.automation_rules,
    comments: Array.isArray(src.comments) ? src.comments : base.comments,
    integrations: Array.isArray(src.integrations) ? src.integrations : base.integrations
  };
}

function trimWorkspacePlatformStore(store) {
  const maxRows = WORKSPACE_PLATFORM_MAX_ROWS;
  const trim = (arr) => (arr.length > maxRows ? arr.slice(-maxRows) : arr);
  return {
    workspaces: trim(store.workspaces),
    projects: trim(store.projects),
    folders: trim(store.folders),
    items: trim(store.items),
    pipelines: trim(store.pipelines),
    automation_rules: trim(store.automation_rules),
    comments: trim(store.comments),
    integrations: trim(store.integrations)
  };
}

function loadWorkspacePlatformStore() {
  if (workspacePlatformStore && typeof workspacePlatformStore === 'object') return workspacePlatformStore;
  try {
    if (!fs.existsSync(WORKSPACE_PLATFORM_FILE)) {
      workspacePlatformStore = defaultWorkspacePlatformStore();
      return workspacePlatformStore;
    }
    const raw = fs.readFileSync(WORKSPACE_PLATFORM_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    workspacePlatformStore = normalizeWorkspacePlatformStore(parsed);
    return workspacePlatformStore;
  } catch (error) {
    logError({ type: 'workspace_platform_load_failed', file: WORKSPACE_PLATFORM_FILE, error: error?.message || 'unknown' });
    workspacePlatformStore = defaultWorkspacePlatformStore();
    return workspacePlatformStore;
  }
}

function saveWorkspacePlatformStore(next) {
  const normalized = trimWorkspacePlatformStore(normalizeWorkspacePlatformStore(next));
  writeJsonAtomic(WORKSPACE_PLATFORM_FILE, normalized);
  workspacePlatformStore = normalized;
  return normalized;
}

function defaultAccountFallbackStore() {
  return {
    profiles: {},
    connections: [],
    sessions: [],
    telegram_link_codes: []
  };
}

function normalizeAccountFallbackStore(raw) {
  const source = asObject(raw);
  return {
    profiles: asObject(source.profiles),
    connections: Array.isArray(source.connections) ? source.connections : [],
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    telegram_link_codes: Array.isArray(source.telegram_link_codes) ? source.telegram_link_codes : []
  };
}

function loadAccountFallbackStore() {
  if (accountFallbackStore && typeof accountFallbackStore === 'object') return accountFallbackStore;
  try {
    if (!fs.existsSync(ACCOUNT_FALLBACK_FILE)) {
      accountFallbackStore = defaultAccountFallbackStore();
      return accountFallbackStore;
    }
    const raw = fs.readFileSync(ACCOUNT_FALLBACK_FILE, 'utf8');
    accountFallbackStore = normalizeAccountFallbackStore(JSON.parse(raw));
    return accountFallbackStore;
  } catch (error) {
    logError({ type: 'account_fallback_load_failed', file: ACCOUNT_FALLBACK_FILE, error: error?.message || 'unknown' });
    accountFallbackStore = defaultAccountFallbackStore();
    return accountFallbackStore;
  }
}

function saveAccountFallbackStore(next) {
  const normalized = normalizeAccountFallbackStore(next);
  if (normalized.connections.length > 5000) {
    normalized.connections = normalized.connections.slice(-5000);
  }
  if (normalized.sessions.length > 10000) {
    normalized.sessions = normalized.sessions.slice(-10000);
  }
  if (normalized.telegram_link_codes.length > 5000) {
    normalized.telegram_link_codes = normalized.telegram_link_codes.slice(-5000);
  }
  writeJsonAtomic(ACCOUNT_FALLBACK_FILE, normalized);
  accountFallbackStore = normalized;
  return normalized;
}

function touchAccountSessionFallback({ req, userId }) {
  const sessionId = normalizeSessionId(req);
  if (!sessionId) return null;
  const sessionHash = hashSessionId(sessionId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + (ACCOUNT_SESSION_TTL_SEC * 1000)).toISOString();
  const userAgent = toCleanText(req.headers['user-agent'] || '', 512) || null;
  const ipAddress = getRequestIpAddress(req);

  const store = loadAccountFallbackStore();
  let row = store.sessions.find((item) => (
    String(item.user_id || '') === userId
    && String(item.session_token_hash || '') === sessionHash
  ));
  if (!row) {
    row = {
      id: uuidv4(),
      user_id: userId,
      session_token_hash: sessionHash,
      user_agent: userAgent,
      ip_address: ipAddress,
      created_at: nowIso,
      last_active_at: nowIso,
      expires_at: expiresAtIso,
      revoked_at: null
    };
    store.sessions.push(row);
  } else {
    row.user_agent = userAgent;
    row.ip_address = ipAddress;
    row.last_active_at = nowIso;
    row.expires_at = expiresAtIso;
    row.revoked_at = null;
  }
  saveAccountFallbackStore(store);
  return { ...row, current_hash: sessionHash };
}

function normalizeWorkspaceRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'editor') return 'editor';
  return 'viewer';
}

function getWorkspaceById(store, workspaceId, userId) {
  const id = String(workspaceId || '').trim();
  const uid = String(userId || '').trim();
  if (!id || !uid) return null;
  const ws = store.workspaces.find((item) => String(item.id || '') === id);
  if (!ws) return null;
  const members = Array.isArray(ws.members) ? ws.members : [];
  const isMember = members.some((member) => String(member.user_id || '') === uid);
  return isMember ? ws : null;
}

function canEditWorkspace(workspace, userId) {
  const uid = String(userId || '').trim();
  const members = Array.isArray(workspace?.members) ? workspace.members : [];
  const role = normalizeWorkspaceRole((members.find((item) => String(item.user_id || '') === uid) || {}).role);
  return role === 'owner' || role === 'editor';
}

function workspaceMemberRole(workspace, userId) {
  const uid = String(userId || '').trim();
  const members = Array.isArray(workspace?.members) ? workspace.members : [];
  return normalizeWorkspaceRole((members.find((item) => String(item.user_id || '') === uid) || {}).role);
}

function normalizePipelineSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((step, idx) => {
      const src = asObject(step);
      const action = String(src.action || '').trim().toLowerCase();
      const tool = String(src.tool || '').trim();
      const settings = asObject(src.settings || {});
      if (!action) return null;
      return {
        id: String(src.id || `step_${idx + 1}`),
        action,
        tool: tool || null,
        settings
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

const WORKFLOW_NODE_TYPES = new Set([
  'upload',
  'analyze',
  'detect',
  'preprocess',
  'convert',
  'compress',
  'postprocess',
  'deliver',
  'export',
  'notify',
  'webhook',
  'ocr',
  'trim',
  'watermark',
  'rename',
  'translate',
  'summarize'
]);

const WORKFLOW_NODE_TO_ACTION = {
  upload: 'ingest',
  analyze: 'analyze',
  detect: 'analyze',
  preprocess: 'preprocess',
  convert: 'convert',
  compress: 'postprocess',
  postprocess: 'postprocess',
  deliver: 'deliver',
  export: 'deliver',
  notify: 'deliver',
  webhook: 'deliver',
  ocr: 'preprocess',
  trim: 'preprocess',
  watermark: 'postprocess',
  rename: 'postprocess',
  translate: 'postprocess',
  summarize: 'postprocess'
};

function normalizeWorkflowNodeType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (!type) return 'convert';
  if (WORKFLOW_NODE_TYPES.has(type)) return type;
  return 'convert';
}

function normalizeWorkflowNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((row, idx) => {
      const src = asObject(row);
      const type = normalizeWorkflowNodeType(src.type || src.kind || src.action || 'convert');
      const rawId = String(src.id || src.node_id || `node_${idx + 1}`).trim();
      const id = clampText(rawId || `node_${idx + 1}`, 120) || `node_${idx + 1}`;
      const label = clampText(String(src.label || src.title || type).trim(), 140) || type;
      const toolRaw = String(src.tool || src.tool_id || '').trim();
      const tool = toolRaw && TOOL_IDS.has(toolRaw) ? toolRaw : null;
      const settings = asObject(src.settings || src.config || {});
      const positionSrc = asObject(src.position || {});
      const x = Number(positionSrc.x);
      const y = Number(positionSrc.y);
      const position = {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0
      };
      return {
        id,
        type,
        label,
        tool,
        settings,
        position
      };
    })
    .filter((item) => Boolean(item?.id))
    .slice(0, 64);
}

function normalizeWorkflowEdges(edges, nodes) {
  if (!Array.isArray(edges)) return [];
  const nodeIds = new Set((Array.isArray(nodes) ? nodes : []).map((item) => String(item.id || '').trim()).filter(Boolean));
  return edges
    .map((row, idx) => {
      const src = asObject(row);
      const source = clampText(String(src.source || src.from || '').trim(), 120);
      const target = clampText(String(src.target || src.to || '').trim(), 120);
      if (!source || !target) return null;
      if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
      const id = clampText(String(src.id || `edge_${idx + 1}`).trim(), 120) || `edge_${idx + 1}`;
      return {
        id,
        source,
        target,
        condition: clampText(String(src.condition || '').trim(), 240) || null
      };
    })
    .filter(Boolean)
    .slice(0, 256);
}

function buildWorkflowGraphFromSteps(steps) {
  const normalizedSteps = normalizePipelineSteps(steps);
  const nodes = normalizedSteps.map((step, idx) => ({
    id: clampText(String(step.id || `node_${idx + 1}`), 120) || `node_${idx + 1}`,
    type: step.action === 'convert' ? 'convert' : (
      step.action === 'analyze'
        ? 'analyze'
        : step.action === 'preprocess'
          ? 'preprocess'
          : step.action === 'postprocess'
            ? 'postprocess'
            : step.action === 'deliver'
              ? 'deliver'
              : 'convert'
    ),
    label: clampText(String(step.action || `Step ${idx + 1}`), 140) || `Step ${idx + 1}`,
    tool: step.tool && TOOL_IDS.has(step.tool) ? step.tool : null,
    settings: asObject(step.settings || {}),
    position: { x: idx * 180, y: 0 }
  }));
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `edge_${i + 1}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      condition: null
    });
  }
  return { nodes, edges };
}

function topologicallySortWorkflow(nodes, edges) {
  const enrichedNodes = nodes.map((item, idx) => ({ ...item, __idx: idx }));
  const nodeById = new Map(enrichedNodes.map((item) => [item.id, item]));
  const indegree = new Map();
  const outgoing = new Map();
  for (const node of enrichedNodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.get(edge.source).push(edge.target);
    indegree.set(edge.target, Number(indegree.get(edge.target) || 0) + 1);
  }

  const queue = enrichedNodes
    .filter((node) => Number(indegree.get(node.id) || 0) === 0)
    .sort((a, b) => a.__idx - b.__idx);
  const ordered = [];

  while (queue.length) {
    const current = queue.shift();
    ordered.push(current);
    const targets = outgoing.get(current.id) || [];
    for (const targetId of targets) {
      const nextDegree = Number(indegree.get(targetId) || 0) - 1;
      indegree.set(targetId, nextDegree);
      if (nextDegree === 0) {
        const nextNode = nodeById.get(targetId);
        if (nextNode) {
          queue.push(nextNode);
          queue.sort((a, b) => a.__idx - b.__idx);
        }
      }
    }
  }

  if (ordered.length !== enrichedNodes.length) {
    const error = new Error('Workflow graph contains a cycle');
    error.code = 'PIPELINE_GRAPH_CYCLE';
    throw error;
  }
  return ordered.map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    tool: item.tool || null,
    settings: asObject(item.settings || {}),
    position: asObject(item.position || { x: 0, y: 0 })
  }));
}

function stepsFromWorkflowNodes(nodes) {
  return normalizePipelineSteps(nodes.map((node, idx) => {
    const action = WORKFLOW_NODE_TO_ACTION[node.type] || 'convert';
    const tool = action === 'convert' && node.tool && TOOL_IDS.has(node.tool) ? node.tool : null;
    return {
      id: String(node.id || `step_${idx + 1}`),
      action,
      tool,
      settings: asObject(node.settings || {})
    };
  }));
}

function compilePipelineDefinition(payload, current = null) {
  const source = asObject(payload || {});
  const hasNodes = Object.prototype.hasOwnProperty.call(source, 'nodes');
  const hasEdges = Object.prototype.hasOwnProperty.call(source, 'edges');
  const hasSteps = Object.prototype.hasOwnProperty.call(source, 'steps');

  const baseSteps = hasSteps
    ? normalizePipelineSteps(source.steps)
    : normalizePipelineSteps(current?.steps);
  let nodes = hasNodes
    ? normalizeWorkflowNodes(source.nodes)
    : normalizeWorkflowNodes(current?.nodes);
  let edges = hasEdges
    ? normalizeWorkflowEdges(source.edges, nodes)
    : normalizeWorkflowEdges(current?.edges, nodes);

  if (!nodes.length && baseSteps.length) {
    const graph = buildWorkflowGraphFromSteps(baseSteps);
    nodes = graph.nodes;
    edges = graph.edges;
  }

  if (!nodes.length) {
    return {
      steps: baseSteps,
      nodes: [],
      edges: []
    };
  }

  const orderedNodes = topologicallySortWorkflow(nodes, edges);
  const steps = stepsFromWorkflowNodes(orderedNodes);
  return {
    steps: steps.length ? steps : baseSteps,
    nodes,
    edges
  };
}

function buildPipelineSummary(pipeline) {
  const steps = normalizePipelineSteps(pipeline?.steps);
  const nodes = normalizeWorkflowNodes(pipeline?.nodes);
  const edges = normalizeWorkflowEdges(pipeline?.edges, nodes);
  const convertSteps = steps.filter((step) => step.action === 'convert' && step.tool && TOOL_IDS.has(step.tool));
  return {
    steps_total: steps.length,
    nodes_total: nodes.length,
    edges_total: edges.length,
    convert_steps: convertSteps.length,
    primary_tool: convertSteps[0]?.tool || null
  };
}

function applyAutomationRulesForJob({ userId, tool, inputSize, settings }) {
  const uid = String(userId || '').trim();
  if (!uid) return { tool, settings, matched_rules: [] };
  const store = loadWorkspacePlatformStore();
  const rules = store.automation_rules
    .filter((rule) => String(rule.user_id || '') === uid && rule.enabled !== false)
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  let nextTool = tool;
  const nextSettings = { ...asObject(settings || {}) };
  const matchedRules = [];
  for (const rule of rules) {
    const condition = asObject(rule.condition || {});
    const matchTool = !condition.tool || String(condition.tool) === String(tool);
    const minSize = Number(condition.min_input_size || 0);
    const maxSize = Number(condition.max_input_size || 0);
    const matchMin = !minSize || Number(inputSize || 0) >= minSize;
    const matchMax = !maxSize || Number(inputSize || 0) <= maxSize;
    if (!matchTool || !matchMin || !matchMax) continue;
    const action = asObject(rule.action || {});
    if (action.override_tool && TOOL_IDS.has(String(action.override_tool))) {
      nextTool = String(action.override_tool);
    }
    if (action.merge_settings && typeof action.merge_settings === 'object') {
      Object.assign(nextSettings, asObject(action.merge_settings));
    }
    matchedRules.push({
      id: String(rule.id || ''),
      name: String(rule.name || ''),
      applied_at: new Date().toISOString()
    });
  }
  return { tool: nextTool, settings: nextSettings, matched_rules: matchedRules };
}

function loadApiKeysStore() {
  if (Array.isArray(apiKeysStore)) return apiKeysStore;
  try {
    if (!fs.existsSync(API_KEYS_FILE)) {
      apiKeysStore = [];
      return apiKeysStore;
    }
    const raw = fs.readFileSync(API_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    apiKeysStore = Array.isArray(parsed) ? parsed : [];
    return apiKeysStore;
  } catch (error) {
    logError({ type: 'api_keys_load_failed', file: API_KEYS_FILE, error: error?.message || 'unknown' });
    apiKeysStore = [];
    return apiKeysStore;
  }
}

function saveApiKeysStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  writeJsonAtomic(API_KEYS_FILE, normalized);
  apiKeysStore = normalized;
  return normalized;
}

function loadApiUsageStore() {
  if (Array.isArray(apiUsageStore)) return apiUsageStore;
  try {
    if (!fs.existsSync(API_USAGE_FILE)) {
      apiUsageStore = [];
      return apiUsageStore;
    }
    const raw = fs.readFileSync(API_USAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    apiUsageStore = Array.isArray(parsed) ? parsed : [];
    return apiUsageStore;
  } catch (error) {
    logError({ type: 'api_usage_load_failed', file: API_USAGE_FILE, error: error?.message || 'unknown' });
    apiUsageStore = [];
    return apiUsageStore;
  }
}

function saveApiUsageStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > API_USAGE_MAX_ROWS ? normalized.slice(-API_USAGE_MAX_ROWS) : normalized;
  writeJsonAtomic(API_USAGE_FILE, trimmed);
  apiUsageStore = trimmed;
  return trimmed;
}

function loadApiWebhooksStore() {
  if (Array.isArray(apiWebhooksStore)) return apiWebhooksStore;
  try {
    if (!fs.existsSync(API_WEBHOOKS_FILE)) {
      apiWebhooksStore = [];
      return apiWebhooksStore;
    }
    const raw = fs.readFileSync(API_WEBHOOKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    apiWebhooksStore = Array.isArray(parsed) ? parsed : [];
    return apiWebhooksStore;
  } catch (error) {
    logError({ type: 'api_webhooks_load_failed', file: API_WEBHOOKS_FILE, error: error?.message || 'unknown' });
    apiWebhooksStore = [];
    return apiWebhooksStore;
  }
}

function saveApiWebhooksStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  writeJsonAtomic(API_WEBHOOKS_FILE, normalized);
  apiWebhooksStore = normalized;
  return normalized;
}

function loadApiWebhookDeliveriesStore() {
  if (Array.isArray(apiWebhookDeliveriesStore)) return apiWebhookDeliveriesStore;
  try {
    if (!fs.existsSync(API_WEBHOOK_DELIVERIES_FILE)) {
      apiWebhookDeliveriesStore = [];
      return apiWebhookDeliveriesStore;
    }
    const raw = fs.readFileSync(API_WEBHOOK_DELIVERIES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    apiWebhookDeliveriesStore = Array.isArray(parsed) ? parsed : [];
    return apiWebhookDeliveriesStore;
  } catch (error) {
    logError({ type: 'api_webhook_deliveries_load_failed', file: API_WEBHOOK_DELIVERIES_FILE, error: error?.message || 'unknown' });
    apiWebhookDeliveriesStore = [];
    return apiWebhookDeliveriesStore;
  }
}

function saveApiWebhookDeliveriesStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > API_USAGE_MAX_ROWS ? normalized.slice(-API_USAGE_MAX_ROWS) : normalized;
  writeJsonAtomic(API_WEBHOOK_DELIVERIES_FILE, trimmed);
  apiWebhookDeliveriesStore = trimmed;
  return trimmed;
}

function loadWorkerHealthChecksStore() {
  if (Array.isArray(workerHealthChecksStore)) return workerHealthChecksStore;
  try {
    if (!fs.existsSync(WORKER_HEALTH_CHECKS_FILE)) {
      workerHealthChecksStore = [];
      return workerHealthChecksStore;
    }
    const raw = fs.readFileSync(WORKER_HEALTH_CHECKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    workerHealthChecksStore = Array.isArray(parsed) ? parsed : [];
    return workerHealthChecksStore;
  } catch (error) {
    logError({ type: 'worker_health_checks_load_failed', file: WORKER_HEALTH_CHECKS_FILE, error: error?.message || 'unknown' });
    workerHealthChecksStore = [];
    return workerHealthChecksStore;
  }
}

function saveWorkerHealthChecksStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > WORKER_HEALTH_MAX_ROWS ? normalized.slice(-WORKER_HEALTH_MAX_ROWS) : normalized;
  writeJsonAtomic(WORKER_HEALTH_CHECKS_FILE, trimmed);
  workerHealthChecksStore = trimmed;
  return trimmed;
}

function loadSyntheticTestResultsStore() {
  if (Array.isArray(syntheticTestResultsStore)) return syntheticTestResultsStore;
  try {
    if (!fs.existsSync(SYNTHETIC_TEST_RESULTS_FILE)) {
      syntheticTestResultsStore = [];
      return syntheticTestResultsStore;
    }
    const raw = fs.readFileSync(SYNTHETIC_TEST_RESULTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    syntheticTestResultsStore = Array.isArray(parsed) ? parsed : [];
    return syntheticTestResultsStore;
  } catch (error) {
    logError({ type: 'synthetic_test_results_load_failed', file: SYNTHETIC_TEST_RESULTS_FILE, error: error?.message || 'unknown' });
    syntheticTestResultsStore = [];
    return syntheticTestResultsStore;
  }
}

function saveSyntheticTestResultsStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > SYNTHETIC_RESULTS_MAX_ROWS ? normalized.slice(-SYNTHETIC_RESULTS_MAX_ROWS) : normalized;
  writeJsonAtomic(SYNTHETIC_TEST_RESULTS_FILE, trimmed);
  syntheticTestResultsStore = trimmed;
  return trimmed;
}

function normalizeFormatHealthState(raw) {
  const source = asObject(raw);
  const out = {};
  for (const toolId of TOOL_IDS) {
    const current = asObject(source[toolId]);
    out[toolId] = {
      tool: toolId,
      disabled: current.disabled === true,
      reason: String(current.reason || '').trim() || null,
      fallback_tool: String(current.fallback_tool || '').trim() || null,
      last_success_at: current.last_success_at || null,
      last_failure_at: current.last_failure_at || null,
      failure_streak: Math.max(0, Number(current.failure_streak || 0)),
      success_count: Math.max(0, Number(current.success_count || 0)),
      failure_count: Math.max(0, Number(current.failure_count || 0)),
      avg_latency_ms: Math.max(0, Number(current.avg_latency_ms || 0)),
      updated_at: current.updated_at || null
    };
  }
  return out;
}

function loadFormatHealthStateStore() {
  if (formatHealthStateStore && typeof formatHealthStateStore === 'object') return formatHealthStateStore;
  try {
    if (!fs.existsSync(FORMAT_HEALTH_STATE_FILE)) {
      formatHealthStateStore = normalizeFormatHealthState({});
      return formatHealthStateStore;
    }
    const raw = fs.readFileSync(FORMAT_HEALTH_STATE_FILE, 'utf8');
    formatHealthStateStore = normalizeFormatHealthState(JSON.parse(raw));
    return formatHealthStateStore;
  } catch (error) {
    logError({ type: 'format_health_state_load_failed', file: FORMAT_HEALTH_STATE_FILE, error: error?.message || 'unknown' });
    formatHealthStateStore = normalizeFormatHealthState({});
    return formatHealthStateStore;
  }
}

function saveFormatHealthStateStore(next) {
  const normalized = normalizeFormatHealthState(next);
  writeJsonAtomic(FORMAT_HEALTH_STATE_FILE, normalized);
  formatHealthStateStore = normalized;
  return normalized;
}

function loadWorkerAlertEventsStore() {
  if (Array.isArray(workerAlertEventsStore)) return workerAlertEventsStore;
  try {
    if (!fs.existsSync(WORKER_ALERT_EVENTS_FILE)) {
      workerAlertEventsStore = [];
      return workerAlertEventsStore;
    }
    const raw = fs.readFileSync(WORKER_ALERT_EVENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    workerAlertEventsStore = Array.isArray(parsed) ? parsed : [];
    return workerAlertEventsStore;
  } catch (error) {
    logError({ type: 'worker_alert_events_load_failed', file: WORKER_ALERT_EVENTS_FILE, error: error?.message || 'unknown' });
    workerAlertEventsStore = [];
    return workerAlertEventsStore;
  }
}

function saveWorkerAlertEventsStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > WORKER_ALERT_MAX_ROWS ? normalized.slice(-WORKER_ALERT_MAX_ROWS) : normalized;
  writeJsonAtomic(WORKER_ALERT_EVENTS_FILE, trimmed);
  workerAlertEventsStore = trimmed;
  return trimmed;
}

function loadWorkerJobResultsStore() {
  if (Array.isArray(workerJobResultsStore)) return workerJobResultsStore;
  try {
    if (!fs.existsSync(WORKER_JOB_RESULTS_FILE)) {
      workerJobResultsStore = [];
      return workerJobResultsStore;
    }
    const raw = fs.readFileSync(WORKER_JOB_RESULTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    workerJobResultsStore = Array.isArray(parsed) ? parsed : [];
    return workerJobResultsStore;
  } catch (error) {
    logError({ type: 'worker_job_results_load_failed', file: WORKER_JOB_RESULTS_FILE, error: error?.message || 'unknown' });
    workerJobResultsStore = [];
    return workerJobResultsStore;
  }
}

function saveWorkerJobResultsStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  const trimmed = normalized.length > WORKER_JOB_RESULTS_MAX_ROWS ? normalized.slice(-WORKER_JOB_RESULTS_MAX_ROWS) : normalized;
  writeJsonAtomic(WORKER_JOB_RESULTS_FILE, trimmed);
  workerJobResultsStore = trimmed;
  return trimmed;
}

function appendWorkerAlertEvent(event) {
  const row = {
    id: uuidv4(),
    type: String(event?.type || 'worker_alert').trim() || 'worker_alert',
    severity: String(event?.severity || 'warning').trim() || 'warning',
    tool: event?.tool ? String(event.tool) : null,
    worker_id: event?.worker_id ? String(event.worker_id) : null,
    message: clampText(String(event?.message || '').trim(), 500) || 'Worker alert',
    details: asObject(event?.details || {}),
    created_at: new Date().toISOString()
  };
  const current = loadWorkerAlertEventsStore().slice();
  current.push(row);
  saveWorkerAlertEventsStore(current);
  return row;
}

function evaluateSyntheticAlertsForTool(toolId) {
  const results = loadSyntheticTestResultsStore()
    .filter((item) => String(item.tool || '') === String(toolId || ''))
    .slice(-SYNTHETIC_ALERT_WINDOW);
  if (!results.length) return;
  const successCount = results.filter((item) => item.success === true).length;
  const successRate = successCount / results.length;
  const avgLatency = results.length
    ? (results.reduce((sum, item) => sum + Math.max(0, Number(item.latency_ms || 0)), 0) / results.length)
    : 0;
  if (successRate < SYNTHETIC_SUCCESS_RATE_THRESHOLD) {
    appendWorkerAlertEvent({
      type: 'synthetic_success_rate_low',
      severity: 'critical',
      tool: toolId,
      message: `Synthetic success rate below threshold for ${toolId}`,
      details: { success_rate: Number(successRate.toFixed(4)), threshold: SYNTHETIC_SUCCESS_RATE_THRESHOLD, window: results.length }
    });
  }
  if (avgLatency > SYNTHETIC_LATENCY_THRESHOLD_MS) {
    appendWorkerAlertEvent({
      type: 'synthetic_latency_high',
      severity: 'warning',
      tool: toolId,
      message: `Synthetic latency exceeded threshold for ${toolId}`,
      details: { avg_latency_ms: Number(avgLatency.toFixed(1)), threshold_ms: SYNTHETIC_LATENCY_THRESHOLD_MS, window: results.length }
    });
  }
}

function updateFormatHealthFromSynthetic(result) {
  const toolId = String(result?.tool || '').trim();
  if (!toolId || !TOOL_IDS.has(toolId)) return null;
  const state = loadFormatHealthStateStore();
  const current = asObject(state[toolId]);
  const nowIso = new Date().toISOString();
  const success = result.success === true;
  const next = {
    ...current,
    tool: toolId,
    last_success_at: success ? (result.created_at || nowIso) : current.last_success_at || null,
    last_failure_at: success ? current.last_failure_at || null : (result.created_at || nowIso),
    failure_streak: success ? 0 : Math.max(0, Number(current.failure_streak || 0)) + 1,
    success_count: Math.max(0, Number(current.success_count || 0)) + (success ? 1 : 0),
    failure_count: Math.max(0, Number(current.failure_count || 0)) + (success ? 0 : 1),
    avg_latency_ms: Math.max(0, Number(result.latency_ms || 0)),
    updated_at: nowIso
  };
  if (!success && next.failure_streak >= FORMAT_FAILURE_DISABLE_STREAK) {
    next.disabled = true;
    next.reason = `Auto-disabled after ${next.failure_streak} synthetic failures`;
    appendWorkerAlertEvent({
      type: 'format_auto_disabled',
      severity: 'critical',
      tool: toolId,
      worker_id: result?.worker_id || null,
      message: `Format ${toolId} was auto-disabled`,
      details: { failure_streak: next.failure_streak, threshold: FORMAT_FAILURE_DISABLE_STREAK, last_error: result?.error || null }
    });
  }
  if (success && next.disabled && String(next.reason || '').startsWith('Auto-disabled')) {
    next.disabled = false;
    next.reason = null;
  }
  const merged = { ...state, [toolId]: next };
  saveFormatHealthStateStore(merged);
  evaluateSyntheticAlertsForTool(toolId);
  return next;
}

function applyFormatStateFromWorkerChecks(checks, workerId) {
  if (!Array.isArray(checks) || !checks.length) return;
  const state = loadFormatHealthStateStore();
  const nowIso = new Date().toISOString();
  let changed = false;
  for (const check of checks) {
    const ok = check?.ok === true;
    const dependency = String(check?.key || '').trim();
    const requiredFor = Array.isArray(check?.requiredFor) ? check.requiredFor.filter((item) => TOOL_IDS.has(String(item || '').trim())) : [];
    if (!dependency || !requiredFor.length) continue;
    for (const toolId of requiredFor) {
      const current = asObject(state[toolId]);
      const reasonText = `Auto-disabled: missing dependency ${dependency}`;
      if (!ok) {
        state[toolId] = {
          ...current,
          tool: toolId,
          disabled: true,
          reason: reasonText,
          updated_at: nowIso,
          dependency
        };
        changed = true;
      } else if (current.disabled && String(current.reason || '').startsWith('Auto-disabled: missing dependency')) {
        state[toolId] = {
          ...current,
          tool: toolId,
          disabled: false,
          reason: null,
          updated_at: nowIso,
          dependency: null
        };
        changed = true;
      }
    }
    if (!ok) {
      appendWorkerAlertEvent({
        type: 'format_dependency_missing',
        severity: 'critical',
        worker_id: workerId || null,
        message: `Dependency ${dependency} is missing`,
        details: { dependency, tools: requiredFor }
      });
    }
  }
  if (changed) {
    saveFormatHealthStateStore(state);
  }
}

const normalizeApiKeyPlan = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'enterprise') return 'enterprise';
  if (value === 'pro') return 'pro';
  return 'free';
};

const resolveApiKeyLimits = (plan, override = {}) => {
  const normalizedPlan = normalizeApiKeyPlan(plan);
  const base = API_KEY_PLAN_LIMITS[normalizedPlan] || API_KEY_PLAN_LIMITS.free;
  return {
    plan: normalizedPlan,
    rate_limit_per_min: Math.max(1, Number(override.rate_limit_per_min || base.rate_limit_per_min)),
    quota_monthly: Math.max(1, Number(override.quota_monthly || base.quota_monthly))
  };
};

const sanitizeIpAllowlist = (raw) => {
  if (!Array.isArray(raw)) return [];
  const allowed = [];
  const seen = new Set();
  for (const entry of raw) {
    const ip = String(entry || '').trim();
    if (!ip) continue;
    if (ip.length > 64) continue;
    if (!/^[0-9a-fA-F:.\/]+$/.test(ip)) continue;
    if (seen.has(ip)) continue;
    seen.add(ip);
    allowed.push(ip);
  }
  return allowed.slice(0, 50);
};

const WEBHOOK_EVENT_SET = new Set(['job.completed', 'job.failed']);
const sanitizeWebhookEvents = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return ['job.completed'];
  const out = [];
  const seen = new Set();
  for (const value of raw) {
    const ev = String(value || '').trim().toLowerCase();
    if (!WEBHOOK_EVENT_SET.has(ev)) continue;
    if (seen.has(ev)) continue;
    seen.add(ev);
    out.push(ev);
  }
  return out.length ? out : ['job.completed'];
};

const normalizeWebhookTargetUrl = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || '').toLowerCase();
    const hostname = String(parsed.hostname || '').toLowerCase();
    const isLocalhost = hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname.endsWith('.local');
    if (protocol !== 'https:' && !(protocol === 'http:' && isLocalhost)) return '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const hashApiKeyToken = (token) => crypto
  .createHash('sha256')
  .update(String(token || ''))
  .digest('hex');

const buildApiKeyPrefix = () => {
  const random = crypto.randomBytes(18).toString('hex');
  return `${API_KEY_DEFAULT_PREFIX}${random}`;
};

const monthIdFromDate = (value = Date.now()) => {
  const d = new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

function getApiKeyByToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) return null;
  const tokenHash = hashApiKeyToken(token);
  const keys = loadApiKeysStore();
  const item = keys.find((entry) => entry.key_hash === tokenHash) || null;
  if (!item) return null;
  return item;
}

function getApiKeyMonthlyUsageCount(apiKeyId, monthId) {
  const usage = loadApiUsageStore();
  return usage.reduce((sum, row) => {
    if (String(row?.api_key_id || '') !== String(apiKeyId || '')) return sum;
    if (String(row?.month || '') !== String(monthId || '')) return sum;
    return sum + 1;
  }, 0);
}

function appendApiUsageEvent(event) {
  const row = {
    id: uuidv4(),
    api_key_id: String(event?.api_key_id || ''),
    endpoint: String(event?.endpoint || ''),
    status: Number(event?.status || 0),
    response_time_ms: Math.max(0, Number(event?.response_time_ms || 0)),
    bytes_processed: Math.max(0, Number(event?.bytes_processed || 0)),
    month: monthIdFromDate(event?.created_at || Date.now()),
    created_at: new Date(event?.created_at || Date.now()).toISOString()
  };
  const current = loadApiUsageStore().slice();
  current.push(row);
  saveApiUsageStore(current);
  return row;
}

function loadShareLinksStore() {
  if (shareLinksStore && typeof shareLinksStore === 'object') return shareLinksStore;
  try {
    if (!fs.existsSync(SHARE_LINKS_FILE)) {
      shareLinksStore = {};
      return shareLinksStore;
    }
    const raw = fs.readFileSync(SHARE_LINKS_FILE, 'utf8');
    shareLinksStore = asObject(JSON.parse(raw));
    return shareLinksStore;
  } catch (error) {
    logError({ type: 'share_links_load_failed', file: SHARE_LINKS_FILE, error: error?.message || 'unknown' });
    shareLinksStore = {};
    return shareLinksStore;
  }
}

function saveShareLinksStore(next) {
  const normalized = asObject(next);
  writeJsonAtomic(SHARE_LINKS_FILE, normalized);
  shareLinksStore = normalized;
  return normalized;
}

function generateShortShareToken(existing = {}) {
  const occupied = asObject(existing);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = createNanoShareId();
    if (!occupied[token]) return token;
  }
  const fallback = crypto.randomBytes(8).toString('hex').slice(0, SHARE_TOKEN_LENGTH);
  return occupied[fallback] ? `${fallback}${Date.now().toString(36).slice(-2)}` : fallback;
}

function extractStorageKeyFromShareUrl(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  const parseWithBase = (value, base) => {
    try {
      return new URL(value, base);
    } catch {
      return null;
    }
  };
  const parsed = parseWithBase(raw, 'http://localhost');
  if (!parsed) return '';
  const pathname = String(parsed.pathname || '').trim();
  const prefixes = ['/api/files/', '/files/'];
  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) continue;
    const encoded = pathname.slice(prefix.length);
    const decoded = encoded
      .split('/')
      .filter(Boolean)
      .map((part) => safeDecodeURIComponent(part))
      .join('/');
    return normalizeStorageKey(decoded);
  }
  return '';
}

function resolveShareStorageKey(item) {
  const payload = asObject(item);
  const explicit = normalizeStorageKey(payload.storage_key || payload.storageKey || '');
  if (explicit) return explicit;
  return extractStorageKeyFromShareUrl(payload.url || payload.file_url || '');
}

function resolveShareTtlSeconds(payload, fallbackPreset = 'seven_days') {
  const source = asObject(payload);
  const preset = String(source.expires_preset || '').trim().toLowerCase();
  const presetSeconds = Object.prototype.hasOwnProperty.call(SHARE_EXPIRY_PRESETS, preset)
    ? SHARE_EXPIRY_PRESETS[preset]
    : null;
  const explicitSeconds = Number(source.expires_in);
  const fallbackSeconds = Object.prototype.hasOwnProperty.call(SHARE_EXPIRY_PRESETS, fallbackPreset)
    ? SHARE_EXPIRY_PRESETS[fallbackPreset]
    : SHARE_EXPIRY_PRESETS.seven_days;
  if (Number.isFinite(explicitSeconds) && explicitSeconds >= 0) {
    return {
      ttlSeconds: explicitSeconds,
      preset: preset || (explicitSeconds === 0 ? 'never' : 'custom')
    };
  }
  const ttlSeconds = presetSeconds !== null ? presetSeconds : fallbackSeconds;
  return {
    ttlSeconds,
    preset: preset || fallbackPreset
  };
}

async function storeUploadedShareFile(req, file, token) {
  const safeOriginalName = sanitizeFileName(String(file?.originalname || 'upload.bin'));
  const parsed = path.parse(safeOriginalName);
  const ext = String(parsed.ext || '').trim() || '.bin';
  const baseName = String(parsed.name || 'upload').trim() || 'upload';
  const dateBucket = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outputName = `${baseName}-${token}${ext}`;
  const storageKey = `outputs/share/${dateBucket}/${outputName}`;
  const buffer = Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.from(file?.buffer || []);
  if (!buffer.length) {
    throw new Error('share_upload_empty_file');
  }
  const contentType = String(file?.mimetype || 'application/octet-stream').trim() || 'application/octet-stream';
  await putObjectBuffer(storageKey, buffer, contentType);
  const fileUrl = buildDownloadUrl(req, storageKey);
  if (!fileUrl) {
    throw new Error('share_upload_url_build_failed');
  }
  return { storageKey, fileUrl, safeOriginalName };
}

function buildExpiredShareTombstone(token, sourceItem, nowMs = Date.now()) {
  const item = asObject(sourceItem);
  return {
    id: String(token || item.id || '').trim() || String(token || ''),
    status: 'expired',
    code: 'SHARE_LINK_EXPIRED',
    message: 'Срок действия ссылки истек',
    created_at: Number(item.created_at || 0) || nowMs,
    expires_at: Number(item.expires_at || 0) || nowMs,
    expired_at: nowMs
  };
}

function hasActiveShareForStorageKey(shares, storageKey, nowMs = Date.now()) {
  const normalizedKey = normalizeStorageKey(storageKey);
  if (!normalizedKey) return false;
  return Object.values(asObject(shares)).some((rawItem) => {
    const item = asObject(rawItem);
    if (resolveShareStorageKey(item) !== normalizedKey) return false;
    const expiresAt = Number(item.expires_at || 0);
    return !expiresAt || expiresAt > nowMs;
  });
}

function pruneEmptyDirectories(startDir, stopDir) {
  const safeStopDir = path.resolve(stopDir);
  let current = path.resolve(startDir);
  while (current.startsWith(safeStopDir) && current !== safeStopDir) {
    try {
      const entries = fs.readdirSync(current);
      if (entries.length > 0) return;
      fs.rmdirSync(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

async function deleteStoredObject(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!key) return false;
  if (storageMode === 's3') {
    try {
      await ensureBucketAvailable();
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key
      }));
      return true;
    } catch (error) {
      const code = String(error?.name || error?.Code || '').trim();
      if (code === 'NoSuchKey' || code === 'NotFound') return false;
      throw error;
    }
  }
  const diskPath = path.join(localRoot, key);
  if (!fs.existsSync(diskPath)) return false;
  fs.unlinkSync(diskPath);
  pruneEmptyDirectories(path.dirname(diskPath), localRoot);
  return true;
}

async function hasStoredObject(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!key) return false;
  if (storageMode === 's3') {
    try {
      await headObject(key);
      return true;
    } catch (error) {
      const code = String(error?.name || error?.Code || '').trim();
      if (code === 'NoSuchKey' || code === 'NotFound' || code === 'NoSuchBucket') return false;
      throw error;
    }
  }
  const diskPath = path.join(localRoot, key);
  return fs.existsSync(diskPath);
}

async function purgeExpiredShareLinks(reason = 'manual') {
  const current = asObject(loadShareLinksStore());
  const now = Date.now();
  const next = { ...current };
  const expiredEntries = [];

  for (const [token, rawItem] of Object.entries(current)) {
    const item = asObject(rawItem);
    if (String(item.status || '').trim().toLowerCase() === 'expired') continue;
    const expiresAt = Number(item.expires_at || 0);
    if (!expiresAt || expiresAt > now) continue;
    expiredEntries.push([token, item]);
    next[token] = buildExpiredShareTombstone(token, item, now);
  }

  if (!expiredEntries.length) return { removed: 0, deletedFiles: 0 };

  const deletedKeys = new Set();
  let deletedFiles = 0;
  for (const [, item] of expiredEntries) {
    const storageKey = resolveShareStorageKey(item);
    if (!storageKey || deletedKeys.has(storageKey)) continue;
    if (hasActiveShareForStorageKey(next, storageKey, now)) continue;
    try {
      const deleted = await deleteStoredObject(storageKey);
      if (deleted) deletedFiles += 1;
      deletedKeys.add(storageKey);
    } catch (error) {
      logError({
        type: 'share_expired_file_delete_failed',
        reason,
        storageKey,
        error: error?.message || 'unknown'
      });
    }
  }

  saveShareLinksStore(next);
  log({
    type: 'share_links_expired_purged',
    reason,
    removed: expiredEntries.length,
    deletedFiles
  });
  return { removed: expiredEntries.length, deletedFiles };
}

function startShareCleanupLoop() {
  if (SERVERLESS_RUNTIME) return;
  if (shareCleanupTimer) return;
  shareCleanupTimer = setInterval(() => {
    void purgeExpiredShareLinks('interval').catch((error) => {
      logError({
        type: 'share_cleanup_failed',
        error: error?.message || 'unknown'
      });
    });
  }, SHARE_CLEANUP_INTERVAL_MS);
  if (typeof shareCleanupTimer.unref === 'function') shareCleanupTimer.unref();
  void purgeExpiredShareLinks('startup').catch((error) => {
    logError({
      type: 'share_cleanup_startup_failed',
      error: error?.message || 'unknown'
    });
  });
}

function loadAuditLogsStore() {
  if (Array.isArray(auditLogsStore)) return auditLogsStore;
  try {
    if (!fs.existsSync(AUDIT_LOGS_FILE)) {
      auditLogsStore = [];
      return auditLogsStore;
    }
    const raw = fs.readFileSync(AUDIT_LOGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    auditLogsStore = Array.isArray(parsed) ? parsed : [];
    return auditLogsStore;
  } catch (error) {
    logError({ type: 'audit_logs_load_failed', file: AUDIT_LOGS_FILE, error: error?.message || 'unknown' });
    auditLogsStore = [];
    return auditLogsStore;
  }
}

function saveAuditLogsStore(next) {
  const normalized = Array.isArray(next) ? next : [];
  writeJsonAtomic(AUDIT_LOGS_FILE, normalized);
  auditLogsStore = normalized;
  return normalized;
}

function appendAuditLog(req, action, details = {}) {
  try {
    const actor = req?.admin && typeof req.admin === 'object' ? req.admin : {};
    const current = loadAuditLogsStore().slice();
    current.push({
      id: uuidv4(),
      action: String(action || 'unknown'),
      actor: {
        sub: String(actor.sub || 'admin'),
        role: String(actor.role || ADMIN_DEFAULT_ROLE || 'super_admin'),
        sid: actor.sid || null
      },
      method: req?.method || null,
      path: req?.path || null,
      request_id: req?.requestId || null,
      details: asObject(details),
      created_at: new Date().toISOString()
    });
    saveAuditLogsStore(current.length > 5000 ? current.slice(-5000) : current);
  } catch (error) {
    logError({ type: 'audit_log_append_failed', action: String(action || 'unknown'), error: error?.message || 'unknown' });
  }
}

function loadLocalizationOverridesStore() {
  if (localizationOverridesStore && typeof localizationOverridesStore === 'object') return localizationOverridesStore;
  try {
    if (!fs.existsSync(LOCALIZATION_OVERRIDES_FILE)) {
      localizationOverridesStore = {};
      return localizationOverridesStore;
    }
    const raw = fs.readFileSync(LOCALIZATION_OVERRIDES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    localizationOverridesStore = asObject(parsed);
    return localizationOverridesStore;
  } catch (error) {
    logError({ type: 'localization_overrides_load_failed', file: LOCALIZATION_OVERRIDES_FILE, error: error?.message || 'unknown' });
    localizationOverridesStore = {};
    return localizationOverridesStore;
  }
}

function saveLocalizationOverridesStore(next) {
  const normalized = asObject(next);
  writeJsonAtomic(LOCALIZATION_OVERRIDES_FILE, normalized);
  localizationOverridesStore = normalized;
}

function detectImageExtFromMime(mime) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return '';
}

function parseDataUrlImage(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = detectImageExtFromMime(mime);
  if (!ext) return null;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length) return null;
  return { mime, ext, buffer };
}

function getRequestBaseUrl(req) {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = protoHeader || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}`;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function normalizeStorageKey(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length) return '';
  if (parts.some((part) => part === '.' || part === '..')) return '';
  return parts.join('/');
}

function encodeStorageKeyForUrl(value) {
  const normalized = normalizeStorageKey(value);
  if (!normalized) return '';
  return normalized.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function buildDownloadUrl(req, outputKey) {
  const encodedKey = encodeStorageKeyForUrl(outputKey);
  if (!encodedKey) return null;
  const base = getRequestBaseUrl(req);
  const relative = `/api/files/${encodedKey}`;
  return base ? `${base}${relative}` : relative;
}

function inferContentTypeFromKey(key) {
  const ext = path.extname(String(key || '')).replace('.', '').toLowerCase();
  if (!ext) return '';
  const map = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    html: 'text/html; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    yaml: 'application/x-yaml; charset=utf-8',
    yml: 'application/x-yaml; charset=utf-8',
    toml: 'application/toml; charset=utf-8',
    ini: 'text/plain; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    m4r: 'audio/mp4',
    wma: 'audio/x-ms-wma',
    flac: 'audio/flac',
    aiff: 'audio/aiff',
    amr: 'audio/amr',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
    ogv: 'video/ogg',
    ts: 'video/mp2t',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    bz2: 'application/x-bzip2',
    xz: 'application/x-xz',
    epub: 'application/epub+zip'
  };
  return map[ext] || '';
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

function normalizeJobIdempotencyKey(req, rawBody) {
  const body = asObject(rawBody);
  const headerRaw = req.headers['idempotency-key'];
  const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const candidate = String(
    body.idempotency_key
    || body.job_idempotency_key
    || headerValue
    || ''
  ).trim();
  if (!candidate) return null;
  if (candidate.length > JOB_IDEMPOTENCY_KEY_MAX_LEN) return null;
  return candidate;
}

function normalizeSha256(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (!/^[a-f0-9]{64}$/.test(normalized)) return '';
  return normalized;
}

function extractChecksumValue(rawValue) {
  if (typeof rawValue === 'string') return normalizeSha256(rawValue);
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return normalizeSha256(rawValue.value || rawValue.sha256 || rawValue.hash);
  }
  return '';
}

function getJobScopeKey(req) {
  const userId = getRequestUserId(req);
  if (userId) return `user:${userId}`;
  const clientId = getClientId(req);
  if (clientId) return `client:${clientId}`;
  return 'anonymous';
}

function getJobIdempotencyRedisKey(scopeKey, idempotencyKey) {
  const scope = String(scopeKey || '').trim();
  const idempotency = String(idempotencyKey || '').trim();
  return `job:idempotency:${scope}:${idempotency}`;
}

async function readJobIdempotencyResult(scopeKey, idempotencyKey) {
  const key = getJobIdempotencyRedisKey(scopeKey, idempotencyKey);
  try {
    const raw = await withTimeout(
      connection.get(key),
      REDIS_OP_TIMEOUT_MS,
      'redis_get_timeout'
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return asObject(parsed);
  } catch {
    return null;
  }
}

async function writeJobIdempotencyResult(scopeKey, idempotencyKey, payload) {
  const key = getJobIdempotencyRedisKey(scopeKey, idempotencyKey);
  const safePayload = asObject(payload);
  try {
    await withTimeout(
      connection.setex(key, JOB_IDEMPOTENCY_TTL_SEC, JSON.stringify(safePayload)),
      REDIS_OP_TIMEOUT_MS,
      'redis_setex_timeout'
    );
  } catch {
    // Best-effort cache.
  }
}

function buildJobDedupeSignature({ tool, settings, checksums, batch, inputSize }) {
  const normalizedChecksums = (Array.isArray(checksums) ? checksums : [])
    .map((item) => normalizeSha256(item))
    .filter(Boolean)
    .sort();
  if (!normalizedChecksums.length) return '';
  const safeTool = String(tool || '').trim().toLowerCase();
  const settingsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(asObject(settings)))
    .digest('hex')
    .slice(0, 16);
  const signaturePayload = JSON.stringify({
    tool: safeTool,
    batch: Boolean(batch),
    size: Math.max(0, Number(inputSize || 0)),
    settingsHash,
    checksums: normalizedChecksums
  });
  return crypto.createHash('sha256').update(signaturePayload).digest('hex');
}

function getJobDedupeRedisKey(scopeKey, dedupeSignature) {
  const scope = String(scopeKey || '').trim();
  const signature = String(dedupeSignature || '').trim();
  return `job:dedupe:${scope}:${signature}`;
}

async function readJobDedupeJobId(scopeKey, dedupeSignature) {
  const key = getJobDedupeRedisKey(scopeKey, dedupeSignature);
  try {
    const value = await withTimeout(
      connection.get(key),
      REDIS_OP_TIMEOUT_MS,
      'redis_get_timeout'
    );
    return String(value || '').trim() || null;
  } catch {
    return null;
  }
}

async function writeJobDedupeJobId(scopeKey, dedupeSignature, jobId) {
  const key = getJobDedupeRedisKey(scopeKey, dedupeSignature);
  const normalizedJobId = String(jobId || '').trim();
  if (!normalizedJobId) return;
  try {
    await withTimeout(
      connection.setex(key, JOB_DEDUPE_TTL_SEC, normalizedJobId),
      REDIS_OP_TIMEOUT_MS,
      'redis_setex_timeout'
    );
  } catch {
    // Best-effort cache.
  }
}

function getUploadHashRedisKey(sha256) {
  return `upload:sha256:${normalizeSha256(sha256)}`;
}

async function resolveInputKeyByHash(sha256) {
  const normalized = normalizeSha256(sha256);
  if (!normalized) return null;
  const key = getUploadHashRedisKey(normalized);
  try {
    const inputKey = String(
      await withTimeout(connection.get(key), REDIS_OP_TIMEOUT_MS, 'redis_get_timeout')
      || ''
    ).trim();
    if (!inputKey) return null;
    if (!inputKey.startsWith('inputs/')) return null;
    if (storageMode === 's3') {
      const head = await headObject(inputKey);
      if (!head) return null;
    } else {
      const diskPath = path.join(localRoot, inputKey);
      if (!fs.existsSync(diskPath)) return null;
    }
    return inputKey;
  } catch {
    return null;
  }
}

async function rememberInputKeyHash(sha256, inputKey) {
  const normalized = normalizeSha256(sha256);
  const safeInputKey = String(inputKey || '').trim();
  if (!normalized || !safeInputKey || !safeInputKey.startsWith('inputs/')) return;
  const redisKey = getUploadHashRedisKey(normalized);
  try {
    await withTimeout(
      connection.setex(redisKey, UPLOAD_HASH_CACHE_TTL_SEC, safeInputKey),
      REDIS_OP_TIMEOUT_MS,
      'redis_setex_timeout'
    );
  } catch {
    // Best-effort cache.
  }
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

function normalizeAccountBlockFeatureToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isAccountBlockFeatureToken(value) {
  const token = normalizeAccountBlockFeatureToken(value);
  return token ? ACCOUNT_BLOCK_FEATURE_TOKENS.has(token) : false;
}

function isBlockedPayloadValue(value) {
  return parseEnvBoolean(value, false);
}

function isAccountBlockPayload(payload) {
  const safePayload = asObject(payload);
  if (
    isBlockedPayloadValue(safePayload.blocked)
    || isBlockedPayloadValue(safePayload.blocked_forever)
    || isBlockedPayloadValue(safePayload.account_blocked)
    || isBlockedPayloadValue(safePayload.banned)
  ) {
    return true;
  }
  const rawFeatures = Array.isArray(safePayload.features)
    ? safePayload.features
    : (safePayload.feature ? [safePayload.feature] : []);
  return rawFeatures.some((item) => isAccountBlockFeatureToken(item));
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

function isAccountBlockEntitlement(entitlement, nowMs = Date.now()) {
  if (!isEntitlementActive(entitlement, nowMs)) return false;
  if (String(entitlement?.kind || '').trim().toLowerCase() !== 'feature_access') return false;
  return isAccountBlockPayload(entitlement.payload);
}

function getCachedAccountBlockState(rawUserId) {
  const userId = String(rawUserId || '').trim();
  if (!userId) return null;
  const cached = accountBlockStateCache.get(userId);
  if (!cached) return null;
  if (!Number.isFinite(cached.expiresAt) || cached.expiresAt <= Date.now()) {
    accountBlockStateCache.delete(userId);
    return null;
  }
  return cached.value;
}

function setCachedAccountBlockState(rawUserId, value) {
  const userId = String(rawUserId || '').trim();
  if (!userId) return;
  accountBlockStateCache.set(userId, {
    value: asObject(value),
    expiresAt: Date.now() + ACCOUNT_BLOCK_CACHE_TTL_MS
  });
}

function clearCachedAccountBlockState(rawUserId) {
  const userId = String(rawUserId || '').trim();
  if (!userId) return;
  accountBlockStateCache.delete(userId);
}

async function resolveAccountBlockState(rawUserId, requestId = null) {
  const userId = String(rawUserId || '').trim();
  if (!userId) return { blocked: false };

  const cached = getCachedAccountBlockState(userId);
  if (cached) return cached;

  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    const fallback = { blocked: false };
    setCachedAccountBlockState(userId, fallback);
    return fallback;
  }

  const promoUserId = normalizePromoUserId(userId);
  if (!promoUserId) {
    const fallback = { blocked: false };
    setCachedAccountBlockState(userId, fallback);
    return fallback;
  }

  try {
    const result = await promoStorage.pool.query(
      `
        SELECT id, kind, scope, payload, starts_at, ends_at, revoked_at
        FROM user_entitlements
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [promoUserId]
    );
    const nowMs = Date.now();
    const matched = result.rows
      .map((row) => mapEntitlementRow(row))
      .find((item) => isAccountBlockEntitlement(item, nowMs));
    if (matched) {
      const payload = asObject(matched.payload);
      const value = {
        blocked: true,
        reason: toCleanText(payload.reason || payload.block_reason || 'account_blocked', 160) || 'account_blocked',
        blocked_at: matched.starts_at || null,
        entitlement_id: matched.id || null
      };
      setCachedAccountBlockState(userId, value);
      return value;
    }
  } catch (error) {
    logError({
      type: 'account_block_lookup_failed',
      requestId: requestId || null,
      userId,
      error: error?.message || 'unknown'
    });
  }

  const fallback = { blocked: false };
  setCachedAccountBlockState(userId, fallback);
  return fallback;
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
    const shouldBlockAccount = features.some((item) => isAccountBlockFeatureToken(item))
      || isBlockedPayloadValue(safeBenefit.blocked)
      || isBlockedPayloadValue(safeBenefit.blocked_forever)
      || isBlockedPayloadValue(safeBenefit.account_blocked)
      || isBlockedPayloadValue(safeBenefit.banned);
    if (shouldBlockAccount) {
      payload.blocked = true;
      payload.blocked_forever = true;
      const reason = toCleanText(safeBenefit.reason || safeBenefit.block_reason || '', 160);
      if (reason) payload.reason = reason;
      payload.blocked_at = nowDate.toISOString();
    }
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

async function putObjectBuffer(key, buffer, contentType = 'application/octet-stream') {
  if (storageMode === 's3') {
    await ensureBucketAvailable();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return;
  }
  const diskPath = path.join(localRoot, key);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, buffer);
}

function inferExtFromUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const pathname = String(parsed.pathname || '');
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    return ext || '';
  } catch {
    return '';
  }
}

function resolveToolByFormats(inputExt, toFormat) {
  const input = String(inputExt || '').trim().toLowerCase();
  const target = String(toFormat || '').trim().toLowerCase();
  if (!input || !target) return null;
  for (const [toolId, meta] of Object.entries(TOOL_META)) {
    const output = String(meta?.outputExt || '').trim().toLowerCase();
    const inputExts = Array.isArray(meta?.inputExts) ? meta.inputExts : [];
    if (output === target && inputExts.includes(input)) return toolId;
  }
  return null;
}

const AI_FORMAT_TOKEN_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
  htm: 'html',
  ppt: 'pptx',
  powerpoint: 'pptx',
  word: 'docx',
  excel: 'xlsx'
};

function normalizeAiFormatToken(value) {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[.]+/, '')
    .replace(/[^a-z0-9.+-]/g, '');
  if (!token) return null;
  return AI_FORMAT_TOKEN_ALIASES[token] || token;
}

function parseAiJsonObject(rawContent) {
  if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    return rawContent;
  }
  const raw = String(rawContent || '').trim();
  if (!raw) return null;
  const sanitized = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(sanitized);
  } catch {
    const start = sanitized.indexOf('{');
    const end = sanitized.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const candidate = sanitized.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function normalizeAiIntentPayload(rawIntent) {
  const payload = asObject(rawIntent || {});
  const intent = String(payload.intent || '').trim().toLowerCase() === 'convert'
    ? 'convert'
    : 'convert';
  const from = normalizeAiFormatToken(payload.from);
  const to = normalizeAiFormatToken(payload.to);
  return { intent, from, to };
}

function normalizeAiProviderText(rawValue) {
  if (typeof rawValue === 'string') return rawValue.trim();
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((entry) => normalizeAiProviderText(entry))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (rawValue && typeof rawValue === 'object') {
    const text = String(
      rawValue.text
      || rawValue.content
      || rawValue.arguments
      || rawValue.output_text
      || ''
    ).trim();
    if (text) return text;
    try {
      return JSON.stringify(rawValue);
    } catch {
      return '';
    }
  }
  return '';
}

function collectAiIntentCandidates(providerPayload) {
  const candidates = [];
  const pushCandidate = (value) => {
    if (value === null || value === undefined) return;
    candidates.push(value);
  };

  const choice = asObject(providerPayload?.choices?.[0] || {});
  const message = asObject(choice.message || {});
  pushCandidate(message.content);
  pushCandidate(choice.text);
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const toolCall of toolCalls) {
    pushCandidate(toolCall?.function?.arguments);
    pushCandidate(toolCall?.function?.parsed_arguments);
  }

  const output = Array.isArray(providerPayload?.output) ? providerPayload.output : [];
  for (const item of output) {
    pushCandidate(item?.content);
    pushCandidate(item?.text);
  }
  pushCandidate(providerPayload?.output_text);

  return candidates
    .map((value) => normalizeAiProviderText(value))
    .filter(Boolean);
}

function extractAiIntentObject(providerPayload) {
  const candidates = collectAiIntentCandidates(providerPayload);
  for (const candidate of candidates) {
    const parsed = parseAiJsonObject(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function getAiProviderErrorMessage(providerPayload, providerResponse) {
  const raw = providerPayload?.error?.message
    || providerPayload?.message
    || providerResponse?.statusText
    || 'provider_request_failed';
  return String(raw || 'provider_request_failed').trim() || 'provider_request_failed';
}

function isAiResponseFormatUnsupported(statusCode, errorMessage) {
  const status = Number(statusCode || 0);
  if (status !== 400 && status !== 422) return false;
  const message = String(errorMessage || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('response_format')
    || message.includes('json_object')
    || message.includes('json mode')
    || message.includes('json output')
  );
}

async function requestAiIntentFromGroq(text, { includeResponseFormat = true } = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  try {
    const payload = {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: AI_PARSE_INTENT_SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0
    };
    if (includeResponseFormat) {
      payload.response_format = { type: 'json_object' };
    }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'svg', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ogv', 'ts', '3gp', 'mpg', 'mpeg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wma', 'aiff', 'amr', 'm4r']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'epub', 'mobi', 'azw', 'azw3', 'csv', 'tsv', 'html', 'htm', 'md']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tar.gz']);

function asFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Number(fallback);
  return num;
}

function asPositiveNumberOrNull(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function normalizeGoalIntent(rawGoal) {
  const value = String(rawGoal || '').trim().toLowerCase();
  if (!value) return 'convert';
  const contains = (tokens) => tokens.some((token) => value.includes(token));
  if (contains(['compress', 'сж', 'уменьш', 'small', 'smaller', 'size'])) return 'compress';
  if (contains(['print', 'печат', 'типограф'])) return 'print';
  if (contains(['web', 'site', 'сайт', 'browser', 'брауз'])) return 'web';
  if (contains(['edit', 'редакт', 'editable'])) return 'edit';
  if (contains(['email', 'mail', 'почт'])) return 'email';
  if (contains(['tiktok', 'тикток'])) return 'social_tiktok';
  if (contains(['youtube', 'ютуб'])) return 'social_youtube';
  if (contains(['telegram', 'телеграм'])) return 'social_telegram';
  if (contains(['audio', 'sound', 'voice', 'аудио', 'звук'])) return 'audio';
  return value;
}

function getFileCategory(ext) {
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (ext === 'json' || ext === 'xml' || ext === 'yaml' || ext === 'yml' || ext === 'toml' || ext === 'ini' || ext === 'sql' || ext === 'log') {
    return 'data';
  }
  return 'binary';
}

function inferTargetFormat({ ext, category, intent, hasAlpha = false, codec = '' }) {
  const normalizedCodec = String(codec || '').trim().toLowerCase();
  if (intent === 'print') return 'pdf';
  if (intent === 'edit' && ext === 'pdf') return 'docx';
  if (intent === 'audio' && VIDEO_EXTENSIONS.has(ext)) return 'mp3';

  if (category === 'image') {
    if (intent === 'compress' || intent === 'web' || intent === 'email') {
      if (hasAlpha) return 'png';
      return 'webp';
    }
    if (intent === 'print') return 'pdf';
    return ext === 'png' ? 'jpg' : 'webp';
  }
  if (category === 'video') {
    if (intent === 'social_tiktok' || intent === 'social_youtube' || intent === 'social_telegram') return 'mp4';
    if (intent === 'compress' || intent === 'web' || intent === 'email') return 'mp4';
    if (normalizedCodec && !normalizedCodec.includes('h264') && !normalizedCodec.includes('avc')) return 'mp4';
    return ext === 'webm' ? 'mp4' : ext;
  }
  if (category === 'audio') {
    if (intent === 'compress' || intent === 'email') return 'mp3';
    if (intent === 'web') return 'aac';
    return ext === 'wav' || ext === 'aiff' ? 'mp3' : ext;
  }
  if (category === 'document') {
    if (intent === 'edit' && ext === 'pdf') return 'docx';
    if (intent === 'web') return 'pdf';
    if (intent === 'compress' && ext === 'pdf') return 'pdf';
    if (ext === 'doc' || ext === 'docx' || ext === 'txt' || ext === 'rtf') return 'pdf';
    return ext === 'pdf' ? 'docx' : 'pdf';
  }
  if (category === 'archive') return 'zip';
  return ext || 'bin';
}

function estimateOutputRatio({ category, intent, ext, targetFormat }) {
  if (intent === 'compress') {
    if (category === 'image') return ext === targetFormat ? 0.55 : 0.62;
    if (category === 'video') return 0.58;
    if (category === 'audio') return 0.64;
    if (category === 'document' && ext === 'pdf') return 0.68;
    return 0.72;
  }
  if (intent === 'email') return 0.6;
  if (intent === 'web') return 0.72;
  if (intent === 'social_tiktok' || intent === 'social_youtube' || intent === 'social_telegram') return 0.75;
  if (ext === targetFormat) return 0.95;
  return 0.9;
}

function buildPresetForIntent({ intent, category, ext, fileSize, hasAlpha, width, height, durationSec, codec }) {
  const targetFormat = inferTargetFormat({
    ext,
    category,
    intent,
    hasAlpha,
    codec
  });
  const settings = {};
  const constraints = {};

  if (intent === 'social_tiktok') {
    settings.video = { resolution: '1080p', codec: 'h264', fps: 30, bitrate: '8M' };
    constraints.aspect_ratio = '9:16';
    constraints.max_duration_sec = 60;
  } else if (intent === 'social_youtube') {
    settings.video = { resolution: '1080p', codec: 'h264', fps: 30, bitrate: '8M' };
    constraints.aspect_ratio = '16:9';
  } else if (intent === 'social_telegram') {
    settings.video = { resolution: '720p', codec: 'h264', bitrate: '3M' };
    constraints.max_size_mb = 49;
  } else if (intent === 'email') {
    settings.compression = { targetRatio: 0.55, maxSizeMb: 20 };
    if (category === 'video') settings.video = { resolution: '720p', bitrate: '2M' };
    if (category === 'image') settings.image = { quality: hasAlpha ? 88 : 80 };
  } else if (intent === 'compress') {
    if (category === 'video') {
      settings.compression = { targetRatio: 0.6 };
      settings.video = { bitrate: '3M', codec: 'h264' };
    }
    if (category === 'image') {
      settings.image = { quality: hasAlpha ? 88 : 78 };
      settings.compression = { targetRatio: hasAlpha ? 0.72 : 0.6 };
    }
    if (category === 'document' && ext === 'pdf') {
      settings.compression = { targetRatio: 0.68, pdfProfiles: ['/printer', '/ebook', '/screen'] };
    }
    if (category === 'audio') {
      settings.audio = { bitrate: '128k' };
      settings.compression = { targetRatio: 0.64 };
    }
  } else if (intent === 'print') {
    settings.image = { dpi: 300 };
    settings.document = { profile: 'print' };
  } else if (intent === 'web') {
    if (category === 'image') settings.image = { quality: hasAlpha ? 90 : 82 };
    if (category === 'video') settings.video = { bitrate: '4M', codec: 'h264' };
  }

  const ratio = estimateOutputRatio({ category, intent, ext, targetFormat });
  const estimatedOutputSize = fileSize > 0 ? Math.max(1, Math.round(fileSize * ratio)) : null;
  const tool = resolveToolByFormats(ext, targetFormat);
  const duration = durationSec || null;
  const dimension = width && height ? `${width}x${height}` : null;
  const rationale = [];
  rationale.push(`category=${category}`);
  rationale.push(`intent=${intent}`);
  if (dimension) rationale.push(`resolution=${dimension}`);
  if (duration) rationale.push(`duration=${Math.round(duration)}s`);
  if (codec) rationale.push(`codec=${String(codec)}`);

  return {
    intent,
    target_format: targetFormat,
    tool,
    settings,
    constraints,
    estimated_output_size: estimatedOutputSize,
    estimated_ratio: ratio,
    rationale
  };
}

function mergeSettingObjects(base, override) {
  const left = asObject(base || {});
  const right = asObject(override || {});
  const out = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && out[key]
      && typeof out[key] === 'object'
      && !Array.isArray(out[key])
    ) {
      out[key] = { ...asObject(out[key]), ...asObject(value) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function analyzeFileIntelligence({ body, defaultGoal = 'convert' }) {
  const payload = asObject(body || {});
  const fileMeta = asObject(payload.file_meta || payload.fileMeta || {});
  const fileName = String(payload.file_name || payload.fileName || payload.name || fileMeta.name || '').trim();
  const extFromBody = String(payload.ext || payload.extension || fileMeta.ext || '').trim().toLowerCase();
  const ext = extFromBody || path.extname(fileName).replace('.', '').toLowerCase();
  const fileSize = Math.max(0, Number(payload.file_size || payload.fileSize || payload.size || fileMeta.size || fileMeta.size_bytes || 0));
  const mimeType = String(payload.mime_type || payload.mimeType || fileMeta.mime_type || fileMeta.mimeType || '').trim().toLowerCase() || null;
  const width = asPositiveNumberOrNull(payload.width || fileMeta.width);
  const height = asPositiveNumberOrNull(payload.height || fileMeta.height);
  const durationSec = asPositiveNumberOrNull(payload.duration_sec || payload.duration || fileMeta.duration_sec || fileMeta.duration);
  const bitrate = asPositiveNumberOrNull(payload.bitrate || fileMeta.bitrate);
  const codec = String(payload.codec || fileMeta.codec || '').trim().toLowerCase();
  const dpi = asPositiveNumberOrNull(payload.dpi || fileMeta.dpi);
  const pages = asPositiveNumberOrNull(payload.pages || fileMeta.pages);
  const hasAlpha = payload.has_alpha === true || payload.hasAlpha === true || fileMeta.has_alpha === true || fileMeta.hasAlpha === true;
  const intent = normalizeGoalIntent(payload.goal || payload.intent || defaultGoal);
  const category = getFileCategory(ext);
  const preset = buildPresetForIntent({
    intent,
    category,
    ext,
    fileSize,
    hasAlpha,
    width,
    height,
    durationSec,
    codec
  });

  const actions = [];
  if (preset.tool) actions.push(`create_job:${preset.tool}`);
  actions.push(`target_format:${preset.target_format}`);
  if (intent === 'compress') actions.push('optimize_size');
  if (intent === 'web' || intent.startsWith('social_')) actions.push('optimize_delivery');
  if (intent === 'print') actions.push('ensure_print_quality');
  if (pages && pages > 250) actions.push('consider_split_or_batch');
  if (category === 'video' && durationSec && durationSec > 600) actions.push('consider_trim_before_convert');

  return {
    file: {
      name: fileName || null,
      ext: ext || null,
      category,
      mime_type: mimeType,
      size_bytes: fileSize || 0,
      width,
      height,
      duration_sec: durationSec,
      bitrate,
      codec: codec || null,
      dpi,
      pages,
      has_alpha: hasAlpha
    },
    intent,
    preset,
    actions
  };
}

function buildWorkflowFromIntelligence({
  analysis,
  prompt = '',
  name = '',
  source = 'assistant'
}) {
  const resolvedAnalysis = analysis && typeof analysis === 'object' ? analysis : {};
  const intent = String(resolvedAnalysis.intent || 'convert').trim().toLowerCase() || 'convert';
  const file = asObject(resolvedAnalysis.file || {});
  const preset = asObject(resolvedAnalysis.preset || {});
  const ext = String(file.ext || '').trim().toLowerCase();
  const category = String(file.category || '').trim().toLowerCase();
  const targetFormat = String(preset.target_format || ext || 'bin').trim().toLowerCase() || 'bin';
  const convertTool = String(preset.tool || resolveToolByFormats(ext, targetFormat) || '').trim();
  const safeName = clampText(String(name || '').trim(), 160)
    || clampText(`AI ${intent} workflow`, 160)
    || 'AI workflow';

  const nodes = [];
  const addNode = (type, label, extra = {}) => {
    const id = clampText(String(extra.id || `${type}_${nodes.length + 1}`).trim(), 120) || `${type}_${nodes.length + 1}`;
    nodes.push({
      id,
      type: normalizeWorkflowNodeType(type),
      label: clampText(String(label || type).trim(), 140) || type,
      tool: extra.tool && TOOL_IDS.has(String(extra.tool)) ? String(extra.tool) : null,
      settings: asObject(extra.settings || {}),
      position: {
        x: Number(nodes.length) * 200,
        y: 0
      }
    });
    return id;
  };

  addNode('upload', 'Upload file');
  addNode('analyze', 'Analyze metadata', {
    settings: {
      intent,
      source
    }
  });
  if (category === 'image' || category === 'video' || category === 'audio' || intent === 'print') {
    addNode('preprocess', 'Preprocess', {
      settings: {
        quality_profile: intent === 'print' ? 'print' : 'balanced'
      }
    });
  }
  if (convertTool && TOOL_IDS.has(convertTool)) {
    addNode('convert', `Convert to ${targetFormat.toUpperCase()}`, {
      tool: convertTool,
      settings: asObject(preset.settings || {})
    });
  } else {
    addNode('convert', `Convert to ${targetFormat.toUpperCase()}`, {
      settings: asObject(preset.settings || {})
    });
  }
  if (intent === 'compress' || intent === 'email' || intent === 'web' || intent.startsWith('social_')) {
    addNode('compress', 'Optimize output size', {
      settings: {
        target_ratio: Number(preset.estimated_ratio || 0) || null
      }
    });
  }
  addNode('deliver', 'Deliver result', {
    settings: {
      channel: 'download'
    }
  });

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `edge_${i + 1}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      condition: null
    });
  }

  const compiled = compilePipelineDefinition({
    steps: [],
    nodes,
    edges
  });

  return {
    name: safeName,
    prompt: clampText(String(prompt || '').trim(), 500) || null,
    intent,
    source,
    recommendation: {
      tool: convertTool && TOOL_IDS.has(convertTool) ? convertTool : null,
      target_format: targetFormat,
      settings: asObject(preset.settings || {}),
      rationale: Array.isArray(preset.rationale) ? preset.rationale : []
    },
    nodes: compiled.nodes,
    edges: compiled.edges,
    steps: compiled.steps,
    summary: {
      nodes_total: compiled.nodes.length,
      edges_total: compiled.edges.length,
      steps_total: compiled.steps.length
    }
  };
}

function buildAutoscalerRecommendation(queueCounts, currentWorkersInput) {
  const waiting = Math.max(0, asFiniteNumber(queueCounts?.waiting || queueCounts?.wait || 0, 0));
  const delayed = Math.max(0, asFiniteNumber(queueCounts?.delayed || 0, 0));
  const paused = Math.max(0, asFiniteNumber(queueCounts?.paused || 0, 0));
  const active = Math.max(0, asFiniteNumber(queueCounts?.active || 0, 0));
  const prioritized = Math.max(0, asFiniteNumber(queueCounts?.prioritized || 0, 0));
  const backlog = waiting + delayed + prioritized + paused;
  const currentWorkers = Math.max(AUTOSCALER_MIN_WORKERS, Math.floor(asFiniteNumber(currentWorkersInput || AUTOSCALER_MIN_WORKERS, AUTOSCALER_MIN_WORKERS)));
  const byBacklog = Math.ceil(backlog / AUTOSCALER_TARGET_BACKLOG_PER_WORKER);
  const byActive = Math.ceil(active / AUTOSCALER_TARGET_ACTIVE_PER_WORKER);
  let desiredWorkers = Math.max(AUTOSCALER_MIN_WORKERS, byBacklog, byActive);
  if (backlog === 0 && active === 0) {
    desiredWorkers = AUTOSCALER_MIN_WORKERS;
  }
  desiredWorkers = Math.min(AUTOSCALER_MAX_WORKERS, desiredWorkers);
  const delta = desiredWorkers - currentWorkers;
  const decision = delta > 0 ? 'scale_up' : delta < 0 ? 'scale_down' : 'hold';
  return {
    queue: {
      waiting,
      active,
      delayed,
      prioritized,
      paused,
      backlog
    },
    policy: {
      min_workers: AUTOSCALER_MIN_WORKERS,
      max_workers: AUTOSCALER_MAX_WORKERS,
      target_backlog_per_worker: AUTOSCALER_TARGET_BACKLOG_PER_WORKER,
      target_active_per_worker: AUTOSCALER_TARGET_ACTIVE_PER_WORKER
    },
    current_workers: currentWorkers,
    desired_workers: desiredWorkers,
    decision
  };
}

function buildWebhookSignature(secret, payloadText) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(payloadText || '')).digest('hex');
}

async function dispatchApiWebhooks({ apiKeyId, eventName, payload }) {
  const hooks = loadApiWebhooksStore().filter((hook) => (
    String(hook.api_key_id || '') === String(apiKeyId || '')
    && hook.is_active !== false
    && Array.isArray(hook.events)
    && hook.events.includes(eventName)
  ));
  if (!hooks.length) return;
  const body = {
    id: uuidv4(),
    event: eventName,
    ts: new Date().toISOString(),
    payload: asObject(payload || {})
  };
  const bodyText = JSON.stringify(body);
  const deliveries = loadApiWebhookDeliveriesStore().slice();
  for (const hook of hooks) {
    const dedupeKey = `${hook.id}:${eventName}:${String(payload?.job_id || payload?.jobId || '')}`;
    if (deliveries.some((row) => String(row?.dedupe_key || '') === dedupeKey && Number(row.status || 0) >= 200 && Number(row.status || 0) < 300)) {
      continue;
    }
    let status = 0;
    let error = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(String(hook.url || ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-megaconvert-event': eventName,
          'x-megaconvert-signature': buildWebhookSignature(hook.secret || '', bodyText)
        },
        body: bodyText,
        signal: controller.signal
      });
      status = response.status;
      if (!response.ok) {
        error = `HTTP_${response.status}`;
      }
    } catch (dispatchError) {
      status = 0;
      error = dispatchError?.message || 'dispatch_failed';
    } finally {
      clearTimeout(timeout);
    }
    deliveries.push({
      id: uuidv4(),
      webhook_id: hook.id,
      api_key_id: apiKeyId,
      dedupe_key: dedupeKey,
      event: eventName,
      status,
      error,
      created_at: new Date().toISOString()
    });
  }
  saveApiWebhookDeliveriesStore(deliveries);
}

app.get('/health', async (req, res) => {
  const redis = await ensureRedisAvailable(req.requestId);
  if (!redis.ok) {
    return res.status(503).json({ ok: false, storage: storageMode, redis: 'down', error: redis.payload });
  }
  return res.json({ ok: true, storage: storageMode, redis: 'up' });
});

app.get('/health/queue', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const rawCounts = await queue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'waiting-children');
    const counts = {
      waiting: Math.max(0, Number(rawCounts?.waiting || 0)),
      active: Math.max(0, Number(rawCounts?.active || 0)),
      delayed: Math.max(0, Number(rawCounts?.delayed || 0)),
      paused: Math.max(0, Number(rawCounts?.paused || 0)),
      prioritized: Math.max(0, Number(rawCounts?.['waiting-children'] || 0))
    };
    const currentWorkers = Number(req.query.current_workers || req.query.currentWorkers || req.headers['x-current-workers'] || AUTOSCALER_MIN_WORKERS);
    const recommendation = buildAutoscalerRecommendation(counts, currentWorkers);
    return res.json({
      ok: true,
      ...recommendation,
      requestId: req.requestId
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    logError({ type: 'health_queue_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'HEALTH_QUEUE_FAILED', message: 'Failed to read queue health', requestId: req.requestId });
  }
});

app.post('/health/worker/ping', (req, res) => {
  workerHeartbeatAt = Date.now();
  opsCounters.workerPings += 1;
  return res.json({ ok: true, ts: workerHeartbeatAt });
});

app.get('/internal/autoscaler/recommendation', requireInternalWorkerAuth, async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const rawCounts = await queue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'waiting-children');
    const counts = {
      waiting: Math.max(0, Number(rawCounts?.waiting || 0)),
      active: Math.max(0, Number(rawCounts?.active || 0)),
      delayed: Math.max(0, Number(rawCounts?.delayed || 0)),
      paused: Math.max(0, Number(rawCounts?.paused || 0)),
      prioritized: Math.max(0, Number(rawCounts?.['waiting-children'] || 0))
    };
    const currentWorkers = Number(req.query.current_workers || req.query.currentWorkers || req.headers['x-current-workers'] || AUTOSCALER_MIN_WORKERS);
    const recommendation = buildAutoscalerRecommendation(counts, currentWorkers);
    return res.json({
      ok: true,
      recommendation,
      ts: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    logError({ type: 'autoscaler_recommendation_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({
      status: 'error',
      code: 'AUTOSCALER_RECOMMENDATION_FAILED',
      message: 'Failed to calculate autoscaler recommendation',
      requestId: req.requestId
    });
  }
});

app.post('/internal/worker/health-check', requireInternalWorkerAuth, (req, res) => {
  try {
    const payload = asObject(req.body || {});
    const row = {
      id: uuidv4(),
      worker_id: String(payload.worker_id || 'unknown').trim() || 'unknown',
      version: String(payload.version || '').trim() || null,
      status: String(payload.status || 'unknown').trim() || 'unknown',
      duration_ms: Math.max(0, Number(payload.duration_ms || 0)),
      checks: Array.isArray(payload.checks) ? payload.checks.slice(0, 100) : [],
      created_at: payload.created_at || new Date().toISOString()
    };
    const rows = loadWorkerHealthChecksStore().slice();
    rows.push(row);
    saveWorkerHealthChecksStore(rows);
    applyFormatStateFromWorkerChecks(row.checks, row.worker_id);
    if (row.status !== 'ok') {
      appendWorkerAlertEvent({
        type: 'worker_startup_check_failed',
        severity: 'critical',
        worker_id: row.worker_id,
        message: `Worker startup checks failed for ${row.worker_id}`,
        details: { checks: row.checks }
      });
    }
    return res.json({ ok: true, id: row.id });
  } catch (error) {
    logError({ type: 'internal_worker_health_check_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_HEALTH_WRITE_FAILED', message: 'Failed to store worker health check', requestId: req.requestId });
  }
});

app.post('/internal/worker/synthetic-result', requireInternalWorkerAuth, (req, res) => {
  try {
    const payload = asObject(req.body || {});
    const row = {
      id: uuidv4(),
      worker_id: String(payload.worker_id || 'unknown').trim() || 'unknown',
      format_pair: clampText(String(payload.format_pair || '').trim(), 120),
      tool: clampText(String(payload.tool || '').trim(), 120),
      success: payload.success === true,
      validation_status: clampText(String(payload.validation_status || '').trim(), 32) || null,
      latency_ms: Math.max(0, Number(payload.latency_ms || 0)),
      output_ext: clampText(String(payload.output_ext || '').trim(), 32) || null,
      output_size: Math.max(0, Number(payload.output_size || 0)),
      error: clampText(String(payload.error || '').trim(), 500) || null,
      created_at: payload.created_at || new Date().toISOString()
    };
    const rows = loadSyntheticTestResultsStore().slice();
    rows.push(row);
    saveSyntheticTestResultsStore(rows);
    updateFormatHealthFromSynthetic(row);
    return res.json({ ok: true, id: row.id });
  } catch (error) {
    logError({ type: 'internal_synthetic_result_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'SYNTHETIC_RESULT_WRITE_FAILED', message: 'Failed to store synthetic result', requestId: req.requestId });
  }
});

app.post('/internal/worker/job-result', requireInternalWorkerAuth, (req, res) => {
  try {
    const payload = asObject(req.body || {});
    const success = payload.success === true;
    const row = {
      id: uuidv4(),
      worker_id: String(payload.worker_id || 'unknown').trim() || 'unknown',
      job_id: clampText(String(payload.job_id || '').trim(), 128) || null,
      tool: clampText(String(payload.tool || '').trim(), 120) || null,
      batch: payload.batch === true,
      success,
      duration_ms: Math.max(0, Number(payload.duration_ms || 0)),
      error: clampText(String(payload.error || '').trim(), 500) || null,
      request_id: clampText(String(payload.request_id || '').trim(), 128) || null,
      user_id: clampText(String(payload.user_id || '').trim(), 128) || null,
      api_key_id: clampText(String(payload.api_key_id || '').trim(), 128) || null,
      created_at: payload.created_at || new Date().toISOString()
    };
    const results = loadWorkerJobResultsStore().slice();
    results.push(row);
    saveWorkerJobResultsStore(results);
    if (!success && payload.tool) {
      appendWorkerAlertEvent({
        type: 'job_failed',
        severity: 'warning',
        worker_id: payload.worker_id ? String(payload.worker_id) : null,
        tool: String(payload.tool || '').trim() || null,
        message: `Job failed for tool ${String(payload.tool || '').trim() || 'unknown'}`,
        details: {
          job_id: payload.job_id || null,
          duration_ms: Math.max(0, Number(payload.duration_ms || 0)),
          error: clampText(String(payload.error || '').trim(), 500) || null
        }
      });
    }
    return res.json({ ok: true, id: row.id });
  } catch (error) {
    logError({ type: 'internal_worker_job_result_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_JOB_RESULT_WRITE_FAILED', message: 'Failed to process worker job result', requestId: req.requestId });
  }
});

app.get('/health/worker', async (req, res) => {
  const redis = await ensureRedisAvailable(req.requestId);
  if (!redis.ok) {
    return res.status(503).json({ ok: false, worker: 'unknown', redis: 'down', error: redis.payload });
  }
  const now = Date.now();
  const ageMs = workerHeartbeatAt > 0 ? now - workerHeartbeatAt : null;
  const heartbeatTtlMs = 120_000;
  const workerUp = ageMs !== null && ageMs <= heartbeatTtlMs;
  const latestStartup = loadWorkerHealthChecksStore().slice(-1)[0] || null;
  const recentSynthetic = loadSyntheticTestResultsStore().slice(-20);
  const recentSuccessRate = recentSynthetic.length
    ? Number((recentSynthetic.filter((item) => item.success === true).length / recentSynthetic.length).toFixed(4))
    : null;
  return res.json({
    ok: true,
    worker: workerUp ? 'up' : 'stale',
    degraded: !workerUp,
    last_heartbeat_at: workerHeartbeatAt || null,
    heartbeat_age_ms: ageMs,
    startup_check: latestStartup ? {
      status: latestStartup.status,
      created_at: latestStartup.created_at,
      worker_id: latestStartup.worker_id
    } : null,
    synthetic: {
      recent_count: recentSynthetic.length,
      success_rate: recentSuccessRate
    }
  });
});

app.get('/health/storage', async (_req, res) => {
  if (storageMode !== 's3') {
    return res.json({ ok: true, storage: storageMode });
  }
  try {
    await ensureBucketAvailable();
    return res.json({ ok: true, storage: 's3' });
  } catch (error) {
    return res.json({
      ok: true,
      storage: 's3',
      degraded: true,
      error: String(error?.message || 'storage unavailable')
    });
  }
});

app.get('/health/ai', (_req, res) => {
  return res.json({ ok: true, ai: 'available' });
});

function percentile(values, p) {
  if (!Array.isArray(values) || !values.length) return null;
  const sorted = values
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

app.get('/metrics/product', (_req, res) => {
  const rangeDaysRaw = Number(_req.query?.range_days || _req.query?.range || 30);
  const rangeDays = Math.max(1, Math.min(365, Number.isFinite(rangeDaysRaw) ? rangeDaysRaw : 30));
  const sinceTs = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);

  const allResults = loadWorkerJobResultsStore();
  const scoped = allResults.filter((item) => {
    const ts = Date.parse(String(item?.created_at || ''));
    return Number.isFinite(ts) && ts >= sinceTs;
  });
  const total = scoped.length;
  const success = scoped.filter((item) => item.success === true);
  const failed = scoped.filter((item) => item.success !== true);
  const successRate = total ? Number((success.length / total).toFixed(4)) : null;

  const successDurations = success
    .map((item) => Math.max(0, Number(item.duration_ms || 0)))
    .filter((value) => Number.isFinite(value));
  const avgTimeToResultMs = successDurations.length
    ? Math.round(successDurations.reduce((sum, value) => sum + value, 0) / successDurations.length)
    : null;
  const p95TimeToResultMs = percentile(successDurations, 95);

  const actorCounts = new Map();
  for (const item of success) {
    const actor = String(item.api_key_id || item.request_id || '').trim();
    if (!actor) continue;
    actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
  }
  const activeUsers = actorCounts.size;
  const repeatUsers = [...actorCounts.values()].filter((count) => count >= 2).length;
  const repeatRate = activeUsers ? Number((repeatUsers / activeUsers).toFixed(4)) : null;

  return res.json({
    ok: true,
    range_days: rangeDays,
    generated_at: new Date().toISOString(),
    product: {
      total_jobs: total,
      success_jobs: success.length,
      failed_jobs: failed.length,
      success_rate: successRate,
      avg_time_to_result_ms: avgTimeToResultMs,
      p95_time_to_result_ms: p95TimeToResultMs
    },
    retention: {
      active_users: activeUsers,
      repeat_users: repeatUsers,
      repeat_rate: repeatRate
    }
  });
});

app.get('/metrics/ops', (_req, res) => {
  const now = Date.now();
  const workerAgeMs = workerHeartbeatAt > 0 ? now - workerHeartbeatAt : null;
  const synthetic = loadSyntheticTestResultsStore().slice(-SYNTHETIC_ALERT_WINDOW);
  const syntheticSuccessRate = synthetic.length
    ? Number((synthetic.filter((item) => item.success === true).length / synthetic.length).toFixed(4))
    : null;
  const disabledFormats = Object.values(loadFormatHealthStateStore()).filter((item) => item.disabled === true).length;
  return res.json({
    ok: true,
    events_accepted: opsCounters.eventsAccepted,
    worker_pings: opsCounters.workerPings,
    worker_heartbeat_age_ms: workerAgeMs,
    synthetic_recent_count: synthetic.length,
    synthetic_success_rate: syntheticSuccessRate,
    disabled_formats: disabledFormats
  });
});

app.get('/share-expiry-presets', (_req, res) => {
  return res.json({ ok: true, presets: SHARE_EXPIRY_PRESETS, default: 'one_day' });
});

app.get('/share/expiry-presets', (_req, res) => {
  return res.json({ ok: true, presets: SHARE_EXPIRY_PRESETS, default: 'one_day' });
});

app.post(
  '/tools/batch-watermark',
  conversionRateLimitMiddleware,
  (req, res, next) => {
    batchWatermarkUpload.array('files', BATCH_WATERMARK_MAX_FILES)(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json(fileTooLargePayload(req.requestId));
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            status: 'error',
            code: 'TOO_MANY_FILES',
            message: `Maximum ${BATCH_WATERMARK_MAX_FILES} files are allowed per request`,
            requestId: req.requestId
          });
        }
      }
      if (String(error?.message || '') === 'UNSUPPORTED_IMAGE_FORMAT') {
        return res.status(400).json({
          status: 'error',
          code: 'UNSUPPORTED_IMAGE_FORMAT',
          message: 'Only image files are supported for batch watermark',
          requestId: req.requestId
        });
      }
      return next(error);
    });
  },
  async (req, res, next) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    try {
      if (!uploadedFiles.length) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_FILES',
          message: 'Upload at least one image file',
          requestId: req.requestId
        });
      }

      const watermarkText = String(req.body?.watermarkText || req.body?.text || '').trim();
      if (!watermarkText) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_WATERMARK_TEXT',
          message: 'Watermark text is required',
          requestId: req.requestId
        });
      }
      const normalizedText = watermarkText.slice(0, BATCH_WATERMARK_TEXT_MAX_LEN);
      const watermarkColor = normalizeWatermarkColor(req.body?.watermarkColor);
      const watermarkPosition = normalizeWatermarkPosition(req.body?.watermarkPosition);

      const jobs = [];
      for (let index = 0; index < uploadedFiles.length; index += 1) {
        const file = uploadedFiles[index];
        const outputFormat = resolveWatermarkOutputFormat(file?.mimetype, file?.originalname);
        const metadata = await sharp(file.path, { failOnError: true }).metadata();
        if (!metadata?.width || !metadata?.height) {
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_IMAGE',
            message: `Failed to process image: ${String(file?.originalname || `file-${index + 1}`)}`,
            requestId: req.requestId
          });
        }
        jobs.push({
          file,
          width: metadata.width,
          height: metadata.height,
          outputFormat,
          outputName: getWatermarkOutputName(file?.originalname, outputFormat, index)
        });
      }

      const archiveName = `megaconvert-watermark-${Date.now()}.zip`;
      res.status(200);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      const archive = archiver('zip', { zlib: { level: 9 } });
      const archiveDonePromise = new Promise((resolve, reject) => {
        archive.on('error', reject);
        res.on('finish', resolve);
        res.on('close', resolve);
      });

      archive.on('warning', (warning) => {
        if (String(warning?.code || '') !== 'ENOENT') {
          logError({
            type: 'batch_watermark_archive_warning',
            requestId: req.requestId,
            warning: warning?.message || 'unknown'
          });
        }
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          try {
            archive.abort();
          } catch {
            // ignore abort failures
          }
        }
      });

      archive.pipe(res);

      for (const job of jobs) {
        const overlaySvg = buildTextWatermarkSvg({
          width: job.width,
          height: job.height,
          text: normalizedText,
          color: watermarkColor,
          position: watermarkPosition
        });
        const transformer = applySharpOutputFormat(
          sharp(job.file.path, { failOnError: true })
            .rotate()
            .composite([{ input: Buffer.from(overlaySvg), blend: 'over' }]),
          job.outputFormat
        );
        archive.append(transformer, { name: job.outputName });
      }

      archive.finalize();
      await archiveDonePromise;

      log({
        type: 'batch_watermark_completed',
        requestId: req.requestId,
        count: jobs.length,
        position: watermarkPosition
      });
      return undefined;
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({
          status: 'error',
          code: 'BATCH_WATERMARK_FAILED',
          message: 'Failed to process batch watermark request',
          requestId: req.requestId
        });
      }
      logError({
        type: 'batch_watermark_stream_failed',
        requestId: req.requestId,
        error: error?.message || 'unknown'
      });
      return next(error);
    } finally {
      await removeUploadedFiles(uploadedFiles);
    }
  }
);

app.post('/flags/evaluate', (req, res) => {
  const payload = asObject(req.body || {});
  const requested = Array.isArray(payload.flags) ? payload.flags.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const allFlags = asObject(loadPlatformSettingsStore().feature_flags || {});
  if (!requested.length) {
    return res.json({ ok: true, flags: allFlags });
  }
  const subset = {};
  requested.forEach((key) => {
    subset[key] = Boolean(allFlags[key]);
  });
  return res.json({ ok: true, flags: subset });
});

app.post(
  '/share',
  conversionRateLimitMiddleware,
  (req, res, next) => {
    shareUpload.single('file')(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json(fileTooLargePayload(req.requestId));
      }
      return next(error);
    });
  },
  async (req, res) => {
    const payload = asObject(req.body || {});
    const shares = asObject(loadShareLinksStore());
    const token = generateShortShareToken(shares);
    let fileUrl = String(payload.file_url || '').trim();
    let storageKey = '';

    try {
      if (req.file) {
        const stored = await storeUploadedShareFile(req, req.file, token);
        fileUrl = stored.fileUrl;
        storageKey = stored.storageKey;
      }

      if (!fileUrl) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID',
          message: 'file_url or multipart file is required',
          requestId: req.requestId
        });
      }

      if (!storageKey) {
        storageKey = resolveShareStorageKey({
          url: fileUrl,
          storage_key: payload.storage_key || payload.storageKey || ''
        });
      }

      if (storageKey) {
        const exists = await hasStoredObject(storageKey);
        if (!exists) {
          return res.status(404).json({
            status: 'error',
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
            requestId: req.requestId
          });
        }
      }

      const ttlSettings = resolveShareTtlSeconds(payload, req.file ? 'one_day' : 'seven_days');
      const now = Date.now();
      const item = {
        id: token,
        file_id: payload.file_id ? String(payload.file_id) : null,
        url: fileUrl,
        storage_key: storageKey || null,
        expires_preset: ttlSettings.preset,
        expires_in: ttlSettings.ttlSeconds,
        expires_at: ttlSettings.ttlSeconds > 0 ? now + (ttlSettings.ttlSeconds * 1000) : null,
        created_at: now
      };
      shares[token] = item;
      saveShareLinksStore(shares);
      const base = getRequestBaseUrl(req);
      const shareUrl = base ? `${base}/s/${token}` : `/s/${token}`;
      return res.status(201).json({
        ok: true,
        token,
        share_url: shareUrl,
        url: item.url,
        expires_in: item.expires_in,
        expires_at: item.expires_at
      });
    } catch (error) {
      logError({
        type: 'share_create_failed',
        requestId: req.requestId,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'SHARE_CREATE_FAILED',
        message: 'Failed to create share link',
        requestId: req.requestId
      });
    }
  }
);

app.post('/share/24h', async (req, res) => {
  const payload = asObject(req.body || {});
  const fileUrl = String(payload.file_url || '').trim();
  if (!fileUrl) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID',
      message: 'file_url is required',
      requestId: req.requestId
    });
  }

  const storageKey = resolveShareStorageKey({ url: fileUrl });
  if (!storageKey || !storageKey.startsWith('outputs/')) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_FILE_URL',
      message: 'Share link must reference a converted output file',
      requestId: req.requestId
    });
  }

  try {
    const exists = await hasStoredObject(storageKey);
    if (!exists) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        requestId: req.requestId
      });
    }
  } catch (error) {
    logError({
      type: 'share_file_check_failed',
      requestId: req.requestId,
      storageKey,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'SHARE_CREATE_FAILED',
      message: 'Failed to create share link',
      requestId: req.requestId
    });
  }

  const shares = asObject(loadShareLinksStore());
  const token = generateShortShareToken(shares);
  const now = Date.now();
  const ttlSeconds = SHARE_EXPIRY_PRESETS.one_day;
  const item = {
    id: token,
    file_id: payload.file_id ? String(payload.file_id) : null,
    url: fileUrl,
    storage_key: storageKey,
    expires_preset: 'one_day',
    expires_in: ttlSeconds,
    expires_at: now + (ttlSeconds * 1000),
    created_at: now
  };
  shares[token] = item;
  saveShareLinksStore(shares);
  const base = getRequestBaseUrl(req);
  const shareUrl = base ? `${base}/s/${token}` : `/s/${token}`;
  return res.status(201).json({
    ok: true,
    token,
    share_url: shareUrl,
    expires_in: item.expires_in,
    expires_at: item.expires_at
  });
});

app.get('/share/:token', async (req, res) => {
  const token = String(req.params?.token || '').trim();
  const shares = loadShareLinksStore();
  const item = asObject(shares[token]);
  if (!token || !item.id) {
    return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Share not found', requestId: req.requestId });
  }
  if (String(item.status || '').trim().toLowerCase() === 'expired') {
    return res.status(404).json({
      status: 'error',
      code: 'SHARE_LINK_EXPIRED',
      message: 'Срок действия ссылки истек',
      requestId: req.requestId
    });
  }
  if (item.expires_at && Date.now() > Number(item.expires_at)) {
    try {
      await purgeExpiredShareLinks('share_access');
    } catch (error) {
      logError({
        type: 'share_expire_purge_failed',
        requestId: req.requestId,
        token,
        error: error?.message || 'unknown'
      });
    }
    return res.status(404).json({
      status: 'error',
      code: 'SHARE_LINK_EXPIRED',
      message: 'Срок действия ссылки истек',
      requestId: req.requestId
    });
  }
  return res.json(item);
});

function shouldSkipAccountBlockCheck(req) {
  const pathValue = String(req.path || req.originalUrl || '').trim();
  if (!pathValue) return true;
  if (pathValue === '/health') return true;
  if (pathValue === '/account/billing') return true;
  if (pathValue.startsWith('/admin/')) return true;
  if (pathValue.startsWith('/auth/')) return true;
  return false;
}

app.use(async (req, res, next) => {
  const rawUserId = getRequestUserId(req);
  if (!rawUserId) return next();
  if (shouldSkipAccountBlockCheck(req)) return next();
  try {
    const blockState = await resolveAccountBlockState(rawUserId, req.requestId);
    if (!blockState?.blocked) return next();
    return res.status(403).json({
      status: 'error',
      code: 'ACCOUNT_BLOCKED',
      message: 'Account is blocked',
      reason: blockState.reason || 'account_blocked',
      blocked_at: blockState.blocked_at || null,
      requestId: req.requestId
    });
  } catch (error) {
    logError({
      type: 'account_block_check_failed',
      requestId: req.requestId,
      userId: rawUserId,
      error: error?.message || 'unknown'
    });
    return next();
  }
});

function ingestEvent(req, res) {
  const body = asObject(req.body);
  const inferredEvent = String(
    body.event
      || body.type
      || body.stage
      || body.status
      || body.action
      || ''
  ).trim();
  const normalizedBody = (body.event || body.type)
    ? body
    : { ...body, event: inferredEvent || 'client_event' };

  const envelope = normalizeAnalyticsEnvelope(req, normalizedBody);
  const rows = buildAnalyticsRowsFromEnvelope(envelope);
  enqueueAnalyticsRows(rows);
  opsCounters.eventsAccepted += rows.length;

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
}

app.post('/events', ingestEvent);
app.post('/job-events', ingestEvent);

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
    role: ADMIN_DEFAULT_ROLE,
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
      role: String(req.admin.role || ADMIN_DEFAULT_ROLE || 'super_admin'),
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

    const created = mapPromoCodeRow(result.rows[0]);
    appendAuditLog(req, 'admin.promo_codes.create', { promo_id: created?.id || null, code: created?.code || null });
    return res.status(201).json(created);
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
    const updated = mapPromoCodeRow(updateResult.rows[0]);
    appendAuditLog(req, 'admin.promo_codes.update', { promo_id: updated?.id || promoId, code: updated?.code || null });
    return res.json(updated);
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
    appendAuditLog(req, 'admin.promo_codes.delete', { promo_id: promoId, code: String(promoResult.rows[0]?.code || '').trim() || null });
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
    appendAuditLog(req, 'admin.posts.create', { post_id: post.id, slug: post.slug, status: post.status });
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
    appendAuditLog(req, 'admin.posts.update', { post_id: next.id, slug: next.slug, status: next.status });
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
    appendAuditLog(req, 'admin.posts.delete', { post_id: removed.id, slug: removed.slug });
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

app.get('/admin/developers', requireAdminAuth, (req, res) => {
  try {
    return res.json({ ok: true, items: loadDevelopersStore().slice() });
  } catch (error) {
    logError({
      type: 'admin_developers_list_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_READ_FAILED',
      message: 'Failed to load developers',
      requestId: req.requestId
    });
  }
});

app.post('/admin/developers', requireAdminAuth, (req, res) => {
  try {
    const body = asObject(req.body);
    const name = clampText(String(body.name || '').trim(), DEVELOPER_NAME_MAX_LEN);
    if (!name) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_NAME',
        message: 'Developer name is required',
        requestId: req.requestId
      });
    }
    const items = loadDevelopersStore().slice();
    const nowIso = new Date().toISOString();
    const item = normalizeStoredDeveloper({
      id: uuidv4(),
      name,
      role: body.role,
      bio: body.bio,
      avatar_url: body.avatar_url,
      github_url: body.github_url,
      linkedin_url: body.linkedin_url,
      twitter_url: body.twitter_url,
      website_url: body.website_url,
      order_index: body.order_index,
      is_active: body.is_active !== false,
      created_at: nowIso,
      updated_at: nowIso
    });
    items.push(item);
    saveDevelopersStore(items);
    appendAuditLog(req, 'admin.developers.create', { developer_id: item.id, name: item.name });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    logError({
      type: 'admin_developers_create_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_WRITE_FAILED',
      message: 'Failed to create developer',
      requestId: req.requestId
    });
  }
});

app.put('/admin/developers/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_DEVELOPER_ID',
        message: 'Missing developer id',
        requestId: req.requestId
      });
    }
    const body = asObject(req.body);
    const items = loadDevelopersStore().slice();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({
        status: 'error',
        code: 'DEVELOPER_NOT_FOUND',
        message: 'Developer not found',
        requestId: req.requestId
      });
    }
    const current = items[index];
    const updated = normalizeStoredDeveloper({
      ...current,
      ...body,
      id: current.id,
      updated_at: new Date().toISOString()
    });
    items[index] = updated;
    saveDevelopersStore(items);
    appendAuditLog(req, 'admin.developers.update', { developer_id: updated.id, name: updated.name });
    return res.json({ ok: true, item: updated });
  } catch (error) {
    logError({
      type: 'admin_developers_update_failed',
      requestId: req.requestId,
      developerId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_WRITE_FAILED',
      message: 'Failed to update developer',
      requestId: req.requestId
    });
  }
});

app.delete('/admin/developers/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_DEVELOPER_ID',
        message: 'Missing developer id',
        requestId: req.requestId
      });
    }
    const items = loadDevelopersStore().slice();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({
        status: 'error',
        code: 'DEVELOPER_NOT_FOUND',
        message: 'Developer not found',
        requestId: req.requestId
      });
    }
    const removed = items.splice(index, 1)[0];
    saveDevelopersStore(items);
    appendAuditLog(req, 'admin.developers.delete', { developer_id: removed.id, name: removed.name });
    return res.json({ ok: true, id: removed.id });
  } catch (error) {
    logError({
      type: 'admin_developers_delete_failed',
      requestId: req.requestId,
      developerId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_WRITE_FAILED',
      message: 'Failed to delete developer',
      requestId: req.requestId
    });
  }
});

app.patch('/admin/developers/:id/toggle', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_DEVELOPER_ID',
        message: 'Missing developer id',
        requestId: req.requestId
      });
    }
    const items = loadDevelopersStore().slice();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({
        status: 'error',
        code: 'DEVELOPER_NOT_FOUND',
        message: 'Developer not found',
        requestId: req.requestId
      });
    }
    const next = {
      ...items[index],
      is_active: !items[index].is_active,
      updated_at: new Date().toISOString()
    };
    items[index] = normalizeStoredDeveloper(next);
    saveDevelopersStore(items);
    appendAuditLog(req, 'admin.developers.toggle', { developer_id: items[index].id, is_active: items[index].is_active });
    return res.json({ ok: true, item: items[index] });
  } catch (error) {
    logError({
      type: 'admin_developers_toggle_failed',
      requestId: req.requestId,
      developerId: req.params?.id || null,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_WRITE_FAILED',
      message: 'Failed to toggle developer',
      requestId: req.requestId
    });
  }
});

app.get('/developers', (req, res) => {
  try {
    return res.json({ ok: true, items: listPublicDevelopers() });
  } catch (error) {
    logError({
      type: 'developers_public_list_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'DEVELOPERS_READ_FAILED',
      message: 'Failed to load developers',
      requestId: req.requestId
    });
  }
});

app.post('/admin/assets/image', requireAdminAuth, (req, res) => {
  try {
    const dataUrl = String(req.body?.data_url || req.body?.dataUrl || '').trim();
    if (!dataUrl) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_IMAGE',
        message: 'Missing image payload',
        requestId: req.requestId
      });
    }
    const parsed = parseDataUrlImage(dataUrl);
    if (!parsed) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_IMAGE_PAYLOAD',
        message: 'Invalid image data url',
        requestId: req.requestId
      });
    }
    if (parsed.buffer.length > ADMIN_ASSET_IMAGE_MAX_BYTES) {
      return res.status(400).json({
        status: 'error',
        code: 'IMAGE_TOO_LARGE',
        message: `Image exceeds ${Math.floor(ADMIN_ASSET_IMAGE_MAX_BYTES / (1024 * 1024))}MB limit`,
        requestId: req.requestId
      });
    }
    fs.mkdirSync(ADMIN_ASSETS_DIR, { recursive: true });
    const fileName = `${uuidv4()}.${parsed.ext}`;
    const diskPath = path.join(ADMIN_ASSETS_DIR, fileName);
    fs.writeFileSync(diskPath, parsed.buffer);
    // Always return API-proxied path so web frontend can load assets via /api on any environment.
    const url = `/api/admin/assets/${fileName}`;
    appendAuditLog(req, 'admin.assets.upload_image', { file_name: fileName, size_bytes: parsed.buffer.length });
    return res.json({ ok: true, file_name: fileName, url });
  } catch (error) {
    logError({ type: 'admin_asset_upload_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({
      status: 'error',
      code: 'ASSET_UPLOAD_FAILED',
      message: 'Failed to upload image',
      requestId: req.requestId
    });
  }
});

app.get('/admin/assets/:name', (req, res) => {
  const name = path.basename(String(req.params?.name || '').trim());
  if (!name) {
    return res.status(404).json({
      status: 'error',
      code: 'ASSET_NOT_FOUND',
      message: 'Asset not found',
      requestId: req.requestId
    });
  }
  const diskPath = path.join(ADMIN_ASSETS_DIR, name);
  if (!fs.existsSync(diskPath)) {
    return res.status(404).json({
      status: 'error',
      code: 'ASSET_NOT_FOUND',
      message: 'Asset not found',
      requestId: req.requestId
    });
  }
  return res.sendFile(diskPath);
});

app.get('/admin/content/pages', requireAdminAuth, (req, res) => {
  try {
    const items = loadContentPagesStore().slice().sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_content_pages_list_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_PAGES_READ_FAILED', message: 'Failed to load pages', requestId: req.requestId });
  }
});

app.post('/admin/content/pages', requireAdminAuth, (req, res) => {
  try {
    const page = normalizeContentPage(req.body || {});
    const items = loadContentPagesStore().slice();
    if (!page.title) {
      return res.status(400).json({ status: 'error', code: 'INVALID_PAGE_TITLE', message: 'Page title is required', requestId: req.requestId });
    }
    items.push(page);
    saveContentPagesStore(items);
    appendAuditLog(req, 'admin.content.pages.create', { page_id: page.id, slug: page.slug });
    return res.status(201).json({ ok: true, item: page });
  } catch (error) {
    logError({ type: 'admin_content_pages_create_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_PAGES_WRITE_FAILED', message: 'Failed to create page', requestId: req.requestId });
  }
});

app.patch('/admin/content/pages/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    const items = loadContentPagesStore().slice();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'PAGE_NOT_FOUND', message: 'Page not found', requestId: req.requestId });
    }
    const updated = normalizeContentPage({
      ...items[index],
      ...asObject(req.body || {}),
      id,
      updated_at: new Date().toISOString()
    });
    items[index] = updated;
    saveContentPagesStore(items);
    appendAuditLog(req, 'admin.content.pages.update', { page_id: updated.id, slug: updated.slug });
    return res.json({ ok: true, item: updated });
  } catch (error) {
    logError({ type: 'admin_content_pages_update_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_PAGES_WRITE_FAILED', message: 'Failed to update page', requestId: req.requestId });
  }
});

app.delete('/admin/content/pages/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    const pages = loadContentPagesStore().slice();
    const removed = pages.find((item) => item.id === id);
    if (!removed) {
      return res.status(404).json({ status: 'error', code: 'PAGE_NOT_FOUND', message: 'Page not found', requestId: req.requestId });
    }
    const filteredPages = pages.filter((item) => item.id !== id);
    saveContentPagesStore(filteredPages);
    const removedSlug = safeSlug(removed.slug, 'home');
    const blocks = loadContentBlocksStore().slice().filter((item) => item.page_slug !== removedSlug);
    saveContentBlocksStore(blocks);
    appendAuditLog(req, 'admin.content.pages.delete', { page_id: removed.id, slug: removed.slug });
    return res.status(204).send();
  } catch (error) {
    logError({ type: 'admin_content_pages_delete_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_PAGES_WRITE_FAILED', message: 'Failed to delete page', requestId: req.requestId });
  }
});

app.get('/admin/content/blocks', requireAdminAuth, (req, res) => {
  try {
    const pageSlug = String(req.query?.page_slug || '').trim();
    let items = loadContentBlocksStore().slice();
    if (pageSlug) {
      const normalizedPageSlug = safeSlug(pageSlug, 'home');
      items = items.filter((item) => item.page_slug === normalizedPageSlug);
    }
    items.sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_content_blocks_list_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_BLOCKS_READ_FAILED', message: 'Failed to load blocks', requestId: req.requestId });
  }
});

app.post('/admin/content/blocks', requireAdminAuth, (req, res) => {
  try {
    const block = normalizeContentBlock(req.body || {});
    const items = loadContentBlocksStore().slice();
    items.push(block);
    saveContentBlocksStore(items);
    appendAuditLog(req, 'admin.content.blocks.create', { block_id: block.id, page_slug: block.page_slug, type: block.type });
    return res.status(201).json({ ok: true, item: block });
  } catch (error) {
    logError({ type: 'admin_content_blocks_create_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_BLOCKS_WRITE_FAILED', message: 'Failed to create block', requestId: req.requestId });
  }
});

app.patch('/admin/content/blocks/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    const items = loadContentBlocksStore().slice();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'BLOCK_NOT_FOUND', message: 'Block not found', requestId: req.requestId });
    }
    const updated = normalizeContentBlock({
      ...items[index],
      ...asObject(req.body || {}),
      id,
      updated_at: new Date().toISOString()
    });
    items[index] = updated;
    saveContentBlocksStore(items);
    appendAuditLog(req, 'admin.content.blocks.update', { block_id: updated.id, page_slug: updated.page_slug, type: updated.type });
    return res.json({ ok: true, item: updated });
  } catch (error) {
    logError({ type: 'admin_content_blocks_update_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_BLOCKS_WRITE_FAILED', message: 'Failed to update block', requestId: req.requestId });
  }
});

app.delete('/admin/content/blocks/:id', requireAdminAuth, (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    const blocks = loadContentBlocksStore().slice();
    const filtered = blocks.filter((item) => item.id !== id);
    if (filtered.length === blocks.length) {
      return res.status(404).json({ status: 'error', code: 'BLOCK_NOT_FOUND', message: 'Block not found', requestId: req.requestId });
    }
    saveContentBlocksStore(filtered);
    appendAuditLog(req, 'admin.content.blocks.delete', { block_id: id });
    return res.status(204).send();
  } catch (error) {
    logError({ type: 'admin_content_blocks_delete_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'CONTENT_BLOCKS_WRITE_FAILED', message: 'Failed to delete block', requestId: req.requestId });
  }
});

app.get('/admin/settings/platform', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const settings = loadPlatformSettingsStore();
    return res.json({ ok: true, settings, item: settings });
  } catch (error) {
    logError({ type: 'admin_settings_read_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'SETTINGS_READ_FAILED', message: 'Failed to load settings', requestId: req.requestId });
  }
});

app.put('/admin/settings/platform', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const merged = normalizePlatformSettings({
      ...loadPlatformSettingsStore(),
      ...asObject(req.body || {}),
      updated_at: new Date().toISOString()
    });
    savePlatformSettingsStore(merged);
    appendAuditLog(req, 'admin.platform_settings.update', { feature_flags: merged.feature_flags || {} });
    return res.json({ ok: true, settings: merged, item: merged });
  } catch (error) {
    logError({ type: 'admin_settings_write_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'SETTINGS_WRITE_FAILED', message: 'Failed to save settings', requestId: req.requestId });
  }
});

app.get('/admin/audit-logs', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));
    const items = loadAuditLogsStore().slice(-limit).reverse();
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_audit_logs_read_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'AUDIT_READ_FAILED', message: 'Failed to load audit logs', requestId: req.requestId });
  }
});

app.get('/admin/worker/health-checks', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));
    const items = loadWorkerHealthChecksStore().slice(-limit).reverse();
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_worker_health_checks_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_HEALTH_READ_FAILED', message: 'Failed to load worker health checks', requestId: req.requestId });
  }
});

app.get('/admin/worker/synthetic-results', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const toolFilter = String(req.query?.tool || '').trim();
    const limit = Math.min(1000, Math.max(1, Number(req.query?.limit || 200)));
    const items = loadSyntheticTestResultsStore()
      .filter((item) => !toolFilter || String(item.tool || '') === toolFilter)
      .slice(-limit)
      .reverse();
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_synthetic_results_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'SYNTHETIC_RESULTS_READ_FAILED', message: 'Failed to load synthetic results', requestId: req.requestId });
  }
});

app.get('/admin/worker/alerts', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));
    const items = loadWorkerAlertEventsStore().slice(-limit).reverse();
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_worker_alerts_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_ALERTS_READ_FAILED', message: 'Failed to load worker alerts', requestId: req.requestId });
  }
});

app.get('/admin/worker/formats', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const state = loadFormatHealthStateStore();
    const items = Object.values(state).sort((a, b) => String(a.tool || '').localeCompare(String(b.tool || '')));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_worker_formats_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_FORMATS_READ_FAILED', message: 'Failed to load worker format state', requestId: req.requestId });
  }
});

app.patch('/admin/worker/formats/:tool', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const toolId = String(req.params?.tool || '').trim();
    if (!TOOL_IDS.has(toolId)) {
      return res.status(404).json({ status: 'error', code: 'TOOL_NOT_FOUND', message: 'Tool not found', requestId: req.requestId });
    }
    const body = asObject(req.body || {});
    const state = loadFormatHealthStateStore();
    const current = asObject(state[toolId]);
    const disabled = Object.prototype.hasOwnProperty.call(body, 'disabled') ? body.disabled === true : current.disabled === true;
    const fallbackTool = String(body.fallback_tool || current.fallback_tool || '').trim();
    const reason = clampText(String(body.reason || current.reason || '').trim(), 200) || null;
    const next = {
      ...current,
      tool: toolId,
      disabled,
      reason,
      fallback_tool: fallbackTool && TOOL_IDS.has(fallbackTool) ? fallbackTool : null,
      updated_at: new Date().toISOString()
    };
    const merged = { ...state, [toolId]: next };
    saveFormatHealthStateStore(merged);
    appendAuditLog(req, 'admin.worker.format.update', { tool: toolId, disabled: next.disabled, fallback_tool: next.fallback_tool, reason: next.reason });
    return res.json({ ok: true, item: next });
  } catch (error) {
    logError({ type: 'admin_worker_format_update_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKER_FORMATS_WRITE_FAILED', message: 'Failed to update format health state', requestId: req.requestId });
  }
});

app.get('/admin/api-keys', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const userIdFilter = String(req.query?.user_id || '').trim();
    const items = loadApiKeysStore()
      .filter((item) => !userIdFilter || String(item.user_id || '') === userIdFilter)
      .map((item) => mapApiKeyPublic(item))
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_api_keys_list_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_READ_FAILED', message: 'Failed to load API keys', requestId: req.requestId });
  }
});

app.get('/admin/api-usage', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const range = String(req.query?.range || '30d').trim().toLowerCase();
    const now = Date.now();
    const windowMs = range === '24h' ? 24 * 60 * 60 * 1000 : (range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);
    const rows = loadApiUsageStore().filter((row) => {
      const ts = Date.parse(row.created_at || '');
      return Number.isFinite(ts) && (now - ts <= windowMs);
    });
    const byKey = new Map();
    rows.forEach((row) => {
      const keyId = String(row.api_key_id || '');
      const current = byKey.get(keyId) || { api_key_id: keyId, requests: 0, errors: 0, avg_latency_ms: 0 };
      current.requests += 1;
      if (Number(row.status || 0) >= 400) current.errors += 1;
      current.avg_latency_ms += Number(row.response_time_ms || 0);
      byKey.set(keyId, current);
    });
    const topKeys = Array.from(byKey.values()).map((item) => ({
      ...item,
      avg_latency_ms: item.requests ? Number((item.avg_latency_ms / item.requests).toFixed(1)) : 0
    })).sort((a, b) => b.requests - a.requests).slice(0, 20);
    const total = rows.length;
    const errors = rows.filter((row) => Number(row.status || 0) >= 400).length;
    const avgLatency = total
      ? Number((rows.reduce((sum, row) => sum + Number(row.response_time_ms || 0), 0) / total).toFixed(1))
      : 0;
    return res.json({
      ok: true,
      range,
      totals: {
        requests: total,
        errors,
        error_rate: total ? Number((errors / total).toFixed(4)) : 0,
        avg_latency_ms: avgLatency
      },
      top_keys: topKeys
    });
  } catch (error) {
    logError({ type: 'admin_api_usage_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_USAGE_READ_FAILED', message: 'Failed to load API usage', requestId: req.requestId });
  }
});

app.patch('/admin/api-keys/:id/limits', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const keyId = String(req.params?.id || '').trim();
    const body = asObject(req.body || {});
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === keyId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    const limits = resolveApiKeyLimits(body.plan || keys[index].plan, body);
    keys[index] = {
      ...keys[index],
      plan: limits.plan,
      rate_limit_per_min: limits.rate_limit_per_min,
      quota_monthly: limits.quota_monthly,
      allowed_ips: Object.prototype.hasOwnProperty.call(body, 'allowed_ips')
        ? sanitizeIpAllowlist(body.allowed_ips)
        : sanitizeIpAllowlist(keys[index].allowed_ips),
      updated_at: new Date().toISOString()
    };
    saveApiKeysStore(keys);
    appendAuditLog(req, 'admin.api_keys.update_limits', {
      api_key_id: keyId,
      plan: limits.plan,
      rate_limit_per_min: limits.rate_limit_per_min,
      quota_monthly: limits.quota_monthly,
      allowed_ips: sanitizeIpAllowlist(keys[index].allowed_ips)
    });
    return res.json({ ok: true, item: mapApiKeyPublic(keys[index]) });
  } catch (error) {
    logError({ type: 'admin_api_keys_update_limits_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to update API key limits', requestId: req.requestId });
  }
});

app.post('/admin/api-keys/:id/revoke', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const keyId = String(req.params?.id || '').trim();
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === keyId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    keys[index] = {
      ...keys[index],
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    saveApiKeysStore(keys);
    appendAuditLog(req, 'admin.api_keys.revoke', { api_key_id: keyId });
    return res.json({ ok: true, item: mapApiKeyPublic(keys[index]) });
  } catch (error) {
    logError({ type: 'admin_api_keys_revoke_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to revoke API key', requestId: req.requestId });
  }
});

app.get('/admin/api-webhooks', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const userIdFilter = String(req.query?.user_id || '').trim();
    const apiKeyFilter = String(req.query?.api_key_id || '').trim();
    const items = loadApiWebhooksStore()
      .filter((item) => {
        if (userIdFilter && String(item.user_id || '') !== userIdFilter) return false;
        if (apiKeyFilter && String(item.api_key_id || '') !== apiKeyFilter) return false;
        return true;
      })
      .map((item) => mapApiWebhookPublic(item))
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_api_webhooks_list_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_READ_FAILED', message: 'Failed to load API webhooks', requestId: req.requestId });
  }
});

app.get('/admin/api-webhook-deliveries', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const apiKeyFilter = String(req.query?.api_key_id || '').trim();
    const limit = Math.min(1000, Math.max(1, Number(req.query?.limit || API_WEBHOOK_DELIVERY_LIST_LIMIT)));
    const items = loadApiWebhookDeliveriesStore()
      .filter((item) => !apiKeyFilter || String(item.api_key_id || '') === apiKeyFilter)
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
      .slice(0, limit);
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'admin_api_webhook_deliveries_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_READ_FAILED', message: 'Failed to load webhook deliveries', requestId: req.requestId });
  }
});

app.patch('/admin/api-webhooks/:id', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const webhookId = String(req.params?.id || '').trim();
    const body = asObject(req.body || {});
    const hooks = loadApiWebhooksStore().slice();
    const index = hooks.findIndex((item) => item.id === webhookId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found', requestId: req.requestId });
    }
    const current = hooks[index];
    const nextUrl = Object.prototype.hasOwnProperty.call(body, 'url')
      ? normalizeWebhookTargetUrl(body.url)
      : String(current.url || '');
    if (!nextUrl) {
      return res.status(400).json({ status: 'error', code: 'INVALID_WEBHOOK_URL', message: 'Invalid webhook url', requestId: req.requestId });
    }
    hooks[index] = {
      ...current,
      url: nextUrl,
      events: Object.prototype.hasOwnProperty.call(body, 'events')
        ? sanitizeWebhookEvents(body.events)
        : sanitizeWebhookEvents(current.events),
      is_active: Object.prototype.hasOwnProperty.call(body, 'is_active')
        ? body.is_active !== false
        : current.is_active !== false,
      updated_at: new Date().toISOString()
    };
    saveApiWebhooksStore(hooks);
    appendAuditLog(req, 'admin.api_webhooks.update', { webhook_id: webhookId, api_key_id: current.api_key_id });
    return res.json({ ok: true, item: mapApiWebhookPublic(hooks[index]) });
  } catch (error) {
    logError({ type: 'admin_api_webhook_update_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_WRITE_FAILED', message: 'Failed to update webhook', requestId: req.requestId });
  }
});

app.delete('/admin/api-webhooks/:id', requireAdminAuthIfEnabled, (req, res) => {
  try {
    const webhookId = String(req.params?.id || '').trim();
    const hooks = loadApiWebhooksStore().slice();
    const index = hooks.findIndex((item) => item.id === webhookId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found', requestId: req.requestId });
    }
    const [removed] = hooks.splice(index, 1);
    saveApiWebhooksStore(hooks);
    appendAuditLog(req, 'admin.api_webhooks.delete', { webhook_id: webhookId, api_key_id: removed?.api_key_id || null });
    return res.status(204).send();
  } catch (error) {
    logError({ type: 'admin_api_webhook_delete_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_WRITE_FAILED', message: 'Failed to delete webhook', requestId: req.requestId });
  }
});

app.get('/admin/localization/status', requireAdminAuth, (req, res) => {
  try {
    const overrides = loadLocalizationOverridesStore();
    const files = fs.existsSync(FRONTEND_I18N_DIR)
      ? fs.readdirSync(FRONTEND_I18N_DIR).filter((name) => name.endsWith('.json')).sort()
      : [];
    let baseCount = 0;
    const locales = files.map((file) => {
      const lang = file.replace(/\.json$/i, '');
      const diskPath = path.join(FRONTEND_I18N_DIR, file);
      let keysCount = 0;
      try {
        const parsed = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        keysCount = Object.keys(asObject(parsed)).length;
      } catch {
        keysCount = 0;
      }
      if (lang === 'en') baseCount = keysCount;
      const overrideCount = Object.keys(asObject(overrides[lang])).length;
      return { lang, keys_count: keysCount, override_count: overrideCount };
    });
    return res.json({ ok: true, base_lang: 'en', base_count: baseCount, locales });
  } catch (error) {
    logError({ type: 'admin_localization_status_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'LOCALIZATION_STATUS_FAILED', message: 'Failed to load localization status', requestId: req.requestId });
  }
});

app.get('/admin/localization/catalog', requireAdminAuth, (req, res) => {
  try {
    const lang = safeSlug(String(req.query?.lang || 'en').trim(), 'en');
    const filePath = path.join(FRONTEND_I18N_DIR, `${lang}.json`);
    const basePath = path.join(FRONTEND_I18N_DIR, 'en.json');
    const base = fs.existsSync(basePath) ? asObject(JSON.parse(fs.readFileSync(basePath, 'utf8'))) : {};
    const dict = fs.existsSync(filePath) ? asObject(JSON.parse(fs.readFileSync(filePath, 'utf8'))) : {};
    const overrides = asObject(loadLocalizationOverridesStore()[lang]);
    const merged = { ...base, ...dict, ...overrides };
    return res.json({ ok: true, lang, entries: merged, override_count: Object.keys(overrides).length });
  } catch (error) {
    logError({ type: 'admin_localization_catalog_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'LOCALIZATION_CATALOG_FAILED', message: 'Failed to load localization catalog', requestId: req.requestId });
  }
});

app.put('/admin/localization/catalog/:lang', requireAdminAuth, (req, res) => {
  try {
    const lang = safeSlug(String(req.params?.lang || '').trim(), '');
    if (!lang) {
      return res.status(400).json({ status: 'error', code: 'INVALID_LANG', message: 'Invalid locale', requestId: req.requestId });
    }
    const entries = asObject(req.body?.entries || {});
    const sanitized = {};
    Object.entries(entries).forEach(([key, value]) => {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) return;
      sanitized[normalizedKey] = clampText(String(value || ''), 5000);
    });
    const store = loadLocalizationOverridesStore();
    const next = { ...store, [lang]: sanitized };
    saveLocalizationOverridesStore(next);
    appendAuditLog(req, 'admin.localization.catalog.update', { lang, override_count: Object.keys(sanitized).length });
    return res.json({ ok: true, lang, override_count: Object.keys(sanitized).length });
  } catch (error) {
    logError({ type: 'admin_localization_catalog_save_failed', error: error?.message || 'unknown', requestId: req.requestId });
    return res.status(500).json({ status: 'error', code: 'LOCALIZATION_WRITE_FAILED', message: 'Failed to save localization overrides', requestId: req.requestId });
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

const mapApiKeyPublic = (item) => {
  const limits = resolveApiKeyLimits(item?.plan, item || {});
  return {
    id: String(item?.id || ''),
    user_id: String(item?.user_id || ''),
    name: String(item?.name || 'Default'),
    plan: limits.plan,
    rate_limit_per_min: limits.rate_limit_per_min,
    quota_monthly: limits.quota_monthly,
    allowed_ips: sanitizeIpAllowlist(item?.allowed_ips),
    key_prefix: String(item?.key_prefix || ''),
    created_at: item?.created_at || null,
    revoked_at: item?.revoked_at || null,
    last_used_at: item?.last_used_at || null
  };
};

const mapApiWebhookPublic = (item) => ({
  id: String(item?.id || ''),
  api_key_id: String(item?.api_key_id || ''),
  user_id: String(item?.user_id || ''),
  url: String(item?.url || ''),
  events: sanitizeWebhookEvents(item?.events),
  is_active: item?.is_active !== false,
  created_at: item?.created_at || null,
  updated_at: item?.updated_at || null
});

app.get('/account/api-keys', requireUserAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const keys = loadApiKeysStore()
      .filter((item) => String(item.user_id || '') === userId)
      .map((item) => mapApiKeyPublic(item));
    const usage = loadApiUsageStore().filter((row) => {
      const key = keys.find((item) => item.id === String(row.api_key_id || ''));
      return Boolean(key);
    });
    return res.json({
      ok: true,
      items: keys,
      usage_summary: {
        month: monthIdFromDate(),
        requests: usage.filter((row) => String(row.month || '') === monthIdFromDate()).length,
        errors: usage.filter((row) => Number(row.status || 0) >= 400 && String(row.month || '') === monthIdFromDate()).length
      }
    });
  } catch (error) {
    logError({ type: 'account_api_keys_list_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_READ_FAILED', message: 'Failed to load API keys', requestId: req.requestId });
  }
});

app.post('/account/api-keys', requireUserAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const body = asObject(req.body || {});
    const name = clampText(String(body.name || 'Default').trim(), 80) || 'Default';
    const requestedPlan = normalizeApiKeyPlan(body.plan || 'free');
    const keys = loadApiKeysStore().slice();
    const ownKeys = keys.filter((item) => String(item.user_id || '') === userId && !item.revoked_at);
    if (ownKeys.length >= API_KEY_MAX_PER_USER) {
      return res.status(409).json({ status: 'error', code: 'API_KEY_LIMIT_REACHED', message: 'User API key limit reached', requestId: req.requestId });
    }
    const token = buildApiKeyPrefix();
    const limits = resolveApiKeyLimits(requestedPlan, body);
    const item = {
      id: uuidv4(),
      user_id: userId,
      key_hash: hashApiKeyToken(token),
      key_prefix: token.slice(0, 16),
      name,
      plan: limits.plan,
      rate_limit_per_min: limits.rate_limit_per_min,
      quota_monthly: limits.quota_monthly,
      allowed_ips: sanitizeIpAllowlist(body.allowed_ips),
      created_at: new Date().toISOString(),
      revoked_at: null,
      last_used_at: null,
      expires_at: null
    };
    keys.push(item);
    saveApiKeysStore(keys);
    appendAuditLog(req, 'account.api_keys.create', { api_key_id: item.id, user_id: userId, plan: item.plan });
    return res.status(201).json({ ok: true, item: mapApiKeyPublic(item), token });
  } catch (error) {
    logError({ type: 'account_api_keys_create_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to create API key', requestId: req.requestId });
  }
});

app.post('/account/api-keys/:id/revoke', requireUserAuth, (req, res) => {
  try {
    const keyId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === keyId && String(item.user_id || '') === userId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    keys[index] = { ...keys[index], revoked_at: new Date().toISOString() };
    saveApiKeysStore(keys);
    appendAuditLog(req, 'account.api_keys.revoke', { api_key_id: keyId, user_id: userId });
    return res.json({ ok: true, item: mapApiKeyPublic(keys[index]) });
  } catch (error) {
    logError({ type: 'account_api_keys_revoke_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to revoke API key', requestId: req.requestId });
  }
});

app.post('/account/api-keys/:id/regenerate', requireUserAuth, (req, res) => {
  try {
    const keyId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === keyId && String(item.user_id || '') === userId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    const token = buildApiKeyPrefix();
    keys[index] = {
      ...keys[index],
      key_hash: hashApiKeyToken(token),
      key_prefix: token.slice(0, 16),
      revoked_at: null,
      updated_at: new Date().toISOString()
    };
    saveApiKeysStore(keys);
    appendAuditLog(req, 'account.api_keys.regenerate', { api_key_id: keyId, user_id: userId });
    return res.json({ ok: true, item: mapApiKeyPublic(keys[index]), token });
  } catch (error) {
    logError({ type: 'account_api_keys_regenerate_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to regenerate API key', requestId: req.requestId });
  }
});

app.patch('/account/api-keys/:id/allowlist', requireUserAuth, (req, res) => {
  try {
    const keyId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const body = asObject(req.body || {});
    const keys = loadApiKeysStore().slice();
    const index = keys.findIndex((item) => item.id === keyId && String(item.user_id || '') === userId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    const allowedIps = sanitizeIpAllowlist(body.allowed_ips);
    keys[index] = {
      ...keys[index],
      allowed_ips: allowedIps,
      updated_at: new Date().toISOString()
    };
    saveApiKeysStore(keys);
    appendAuditLog(req, 'account.api_keys.allowlist_update', { api_key_id: keyId, user_id: userId, allowed_ips: allowedIps });
    return res.json({ ok: true, item: mapApiKeyPublic(keys[index]) });
  } catch (error) {
    logError({ type: 'account_api_keys_allowlist_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_KEYS_WRITE_FAILED', message: 'Failed to update API key allowlist', requestId: req.requestId });
  }
});

app.get('/account/api-webhooks', requireUserAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const keys = loadApiKeysStore().filter((item) => String(item.user_id || '') === userId);
    const keyIds = new Set(keys.map((item) => String(item.id || '')));
    const items = loadApiWebhooksStore()
      .filter((item) => keyIds.has(String(item.api_key_id || '')))
      .map((item) => mapApiWebhookPublic(item))
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'account_api_webhooks_list_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_READ_FAILED', message: 'Failed to load API webhooks', requestId: req.requestId });
  }
});

app.get('/account/api-webhooks/deliveries', requireUserAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const keyFilter = String(req.query?.api_key_id || '').trim();
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));
    const keyIds = new Set(
      loadApiKeysStore()
        .filter((item) => String(item.user_id || '') === userId)
        .map((item) => String(item.id || ''))
    );
    if (keyFilter && !keyIds.has(keyFilter)) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    const rows = loadApiWebhookDeliveriesStore()
      .filter((item) => {
        const keyId = String(item.api_key_id || '');
        if (!keyIds.has(keyId)) return false;
        if (keyFilter && keyId !== keyFilter) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
      .slice(0, limit);
    return res.json({ ok: true, items: rows });
  } catch (error) {
    logError({ type: 'account_api_webhook_deliveries_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_READ_FAILED', message: 'Failed to load webhook deliveries', requestId: req.requestId });
  }
});

app.post('/account/api-webhooks', requireUserAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const body = asObject(req.body || {});
    const apiKeyId = String(body.api_key_id || '').trim();
    if (!apiKeyId) {
      return res.status(400).json({ status: 'error', code: 'MISSING_API_KEY_ID', message: 'api_key_id is required', requestId: req.requestId });
    }
    const key = loadApiKeysStore().find((item) => item.id === apiKeyId && String(item.user_id || '') === userId && !item.revoked_at);
    if (!key) {
      return res.status(404).json({ status: 'error', code: 'API_KEY_NOT_FOUND', message: 'API key not found', requestId: req.requestId });
    }
    const url = normalizeWebhookTargetUrl(body.url);
    if (!url) {
      return res.status(400).json({ status: 'error', code: 'INVALID_WEBHOOK_URL', message: 'Invalid webhook url', requestId: req.requestId });
    }
    const events = sanitizeWebhookEvents(body.events);
    const webhooks = loadApiWebhooksStore().slice();
    const ownForKey = webhooks.filter((item) => String(item.api_key_id || '') === apiKeyId);
    if (ownForKey.length >= API_WEBHOOKS_MAX_PER_KEY) {
      return res.status(409).json({ status: 'error', code: 'WEBHOOK_LIMIT_REACHED', message: 'Webhook limit reached for API key', requestId: req.requestId });
    }
    const secret = crypto.randomBytes(24).toString('hex');
    const item = {
      id: uuidv4(),
      user_id: userId,
      api_key_id: apiKeyId,
      url,
      events,
      is_active: body.is_active !== false,
      secret,
      created_at: new Date().toISOString(),
      updated_at: null
    };
    webhooks.push(item);
    saveApiWebhooksStore(webhooks);
    appendAuditLog(req, 'account.api_webhooks.create', { webhook_id: item.id, api_key_id: apiKeyId, events });
    return res.status(201).json({ ok: true, item: mapApiWebhookPublic(item), secret });
  } catch (error) {
    logError({ type: 'account_api_webhook_create_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_WRITE_FAILED', message: 'Failed to create webhook', requestId: req.requestId });
  }
});

app.patch('/account/api-webhooks/:id', requireUserAuth, (req, res) => {
  try {
    const webhookId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const body = asObject(req.body || {});
    const hooks = loadApiWebhooksStore().slice();
    const index = hooks.findIndex((item) => item.id === webhookId && String(item.user_id || '') === userId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found', requestId: req.requestId });
    }
    const current = hooks[index];
    const nextUrl = Object.prototype.hasOwnProperty.call(body, 'url')
      ? normalizeWebhookTargetUrl(body.url)
      : String(current.url || '');
    if (!nextUrl) {
      return res.status(400).json({ status: 'error', code: 'INVALID_WEBHOOK_URL', message: 'Invalid webhook url', requestId: req.requestId });
    }
    hooks[index] = {
      ...current,
      url: nextUrl,
      events: Object.prototype.hasOwnProperty.call(body, 'events')
        ? sanitizeWebhookEvents(body.events)
        : sanitizeWebhookEvents(current.events),
      is_active: Object.prototype.hasOwnProperty.call(body, 'is_active')
        ? body.is_active !== false
        : current.is_active !== false,
      updated_at: new Date().toISOString()
    };
    saveApiWebhooksStore(hooks);
    appendAuditLog(req, 'account.api_webhooks.update', { webhook_id: webhookId, api_key_id: current.api_key_id });
    return res.json({ ok: true, item: mapApiWebhookPublic(hooks[index]) });
  } catch (error) {
    logError({ type: 'account_api_webhook_update_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_WRITE_FAILED', message: 'Failed to update webhook', requestId: req.requestId });
  }
});

app.delete('/account/api-webhooks/:id', requireUserAuth, (req, res) => {
  try {
    const webhookId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const hooks = loadApiWebhooksStore().slice();
    const index = hooks.findIndex((item) => item.id === webhookId && String(item.user_id || '') === userId);
    if (index < 0) {
      return res.status(404).json({ status: 'error', code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found', requestId: req.requestId });
    }
    const [removed] = hooks.splice(index, 1);
    saveApiWebhooksStore(hooks);
    appendAuditLog(req, 'account.api_webhooks.delete', { webhook_id: webhookId, api_key_id: removed?.api_key_id || null });
    return res.status(204).send();
  } catch (error) {
    logError({ type: 'account_api_webhook_delete_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_WRITE_FAILED', message: 'Failed to delete webhook', requestId: req.requestId });
  }
});

app.post('/account/api-webhooks/:id/test', requireUserAuth, async (req, res) => {
  try {
    const webhookId = String(req.params?.id || '').trim();
    const userId = req.user.id;
    const hooks = loadApiWebhooksStore();
    const hook = hooks.find((item) => item.id === webhookId && String(item.user_id || '') === userId);
    if (!hook) {
      return res.status(404).json({ status: 'error', code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found', requestId: req.requestId });
    }
    const testJobId = `test_${Date.now()}`;
    await dispatchApiWebhooks({
      apiKeyId: hook.api_key_id,
      eventName: sanitizeWebhookEvents(req.body?.events || hook.events)[0] || 'job.completed',
      payload: {
        job_id: testJobId,
        status: 'completed',
        download_url: null,
        error: null,
        source: 'webhook_test'
      }
    });
    appendAuditLog(req, 'account.api_webhooks.test', { webhook_id: webhookId, api_key_id: hook.api_key_id });
    return res.json({ ok: true, webhook_id: webhookId, test_job_id: testJobId });
  } catch (error) {
    logError({ type: 'account_api_webhook_test_failed', requestId: req.requestId, userId: req.user.id, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_WEBHOOKS_TEST_FAILED', message: 'Failed to send test webhook', requestId: req.requestId });
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
  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
      const store = loadAccountFallbackStore();
      const profile = asObject(store.profiles[userId]);
      return res.json(mapAccountProfileRow(profile, userId));
    } catch (error) {
      logError({
        type: 'account_profile_fallback_read_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_PROFILE_READ_FAILED',
        message: 'Failed to load account profile',
        requestId: req.requestId
      });
    }
  }
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

  const parseOptionalField = (raw, field, maxLen) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    if (typeof raw !== 'string') {
      throw new PromoApiError(400, 'INVALID_ACCOUNT_FIELD', `${field} must be string`);
    }
    return toCleanText(raw, maxLen) || null;
  };

  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
      const store = loadAccountFallbackStore();
      const currentRow = asObject(store.profiles[userId]);
      const nextDisplayName = hasDisplayName
        ? parseOptionalField(body.display_name, 'display_name', ACCOUNT_PROFILE_NAME_MAX_LEN)
        : (toCleanText(currentRow.display_name || '', ACCOUNT_PROFILE_NAME_MAX_LEN) || null);
      const nextTimezone = hasTimezone
        ? parseOptionalField(body.timezone, 'timezone', ACCOUNT_PROFILE_TZ_MAX_LEN)
        : (toCleanText(currentRow.timezone || '', ACCOUNT_PROFILE_TZ_MAX_LEN) || null);
      const nextAvatarUrl = hasAvatarUrl
        ? parseOptionalField(body.avatar_url, 'avatar_url', ACCOUNT_PROFILE_AVATAR_MAX_LEN)
        : (toCleanText(currentRow.avatar_url || '', ACCOUNT_PROFILE_AVATAR_MAX_LEN) || null);

      store.profiles[userId] = {
        display_name: nextDisplayName,
        timezone: nextTimezone,
        avatar_url: nextAvatarUrl,
        updated_at: new Date().toISOString()
      };
      saveAccountFallbackStore(store);
      log({
        type: 'account_profile_update_fallback',
        requestId: req.requestId,
        userId
      });
      return res.json(mapAccountProfileRow(store.profiles[userId], userId));
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
        type: 'account_profile_fallback_update_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_PROFILE_WRITE_FAILED',
        message: 'Failed to update account profile',
        requestId: req.requestId
      });
    }
  }
  try {
    await touchAccountSession({ pool: storage.pool, req, userId });

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
  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
      const store = loadAccountFallbackStore();
      const mapped = store.connections
        .filter((row) => String(row.user_id || '') === userId)
        .map((row) => mapAccountConnectionRow(row))
        .filter(Boolean);
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
      logError({
        type: 'account_connections_fallback_read_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_CONNECTIONS_READ_FAILED',
        message: 'Failed to load connected accounts',
        requestId: req.requestId
      });
    }
  }
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

  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
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

      const store = loadAccountFallbackStore();
      const globalConflict = store.connections.find((row) => (
        String(row.provider || '') === provider
        && String(row.provider_user_id || '') === providerUserId
        && String(row.user_id || '') !== userId
      ));
      if (globalConflict) {
        return res.status(409).json({
          status: 'error',
          code: 'PROVIDER_ALREADY_LINKED',
          message: 'Provider account is already linked to another user',
          requestId: req.requestId
        });
      }

      const existingIndex = store.connections.findIndex((row) => (
        String(row.user_id || '') === userId
        && String(row.provider || '') === provider
      ));
      const existing = existingIndex >= 0 ? mapAccountConnectionRow(store.connections[existingIndex]) : null;
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

      const row = {
        id: existing?.id || uuidv4(),
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        email: providerEmail,
        linked_at: new Date().toISOString()
      };
      if (existingIndex >= 0) {
        store.connections[existingIndex] = row;
      } else {
        store.connections.push(row);
      }
      saveAccountFallbackStore(store);
      const connection = mapAccountConnectionRow(row);
      log({
        type: 'account_provider_link_fallback',
        requestId: req.requestId,
        userId,
        provider
      });
      return res.json({
        status: 'linked',
        connection: {
          provider,
          connected: true,
          email: connection?.email || null,
          linked_at: connection?.linked_at || null
        }
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
      logError({
        type: 'account_connections_fallback_link_failed',
        requestId: req.requestId,
        userId: userId || null,
        provider: provider || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_CONNECTIONS_WRITE_FAILED',
        message: 'Failed to link provider',
        requestId: req.requestId
      });
    }
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

  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
      const store = loadAccountFallbackStore();
      const userRows = store.connections.filter((row) => String(row.user_id || '') === userId);
      const targetIndex = store.connections.findIndex((row) => (
        String(row.user_id || '') === userId
        && String(row.provider || '') === provider
      ));
      if (targetIndex < 0) {
        return res.json({
          status: 'disconnected',
          provider,
          already_disconnected: true
        });
      }
      if (userRows.length <= 1) {
        return res.status(400).json({
          status: 'error',
          code: 'CANNOT_REMOVE_LAST_LOGIN_METHOD',
          message: 'Cannot remove the last login method',
          requestId: req.requestId
        });
      }
      store.connections.splice(targetIndex, 1);
      saveAccountFallbackStore(store);
      log({
        type: 'account_provider_unlink_fallback',
        requestId: req.requestId,
        userId,
        provider
      });
      return res.json({
        status: 'disconnected',
        provider
      });
    } catch (error) {
      logError({
        type: 'account_connections_fallback_unlink_failed',
        requestId: req.requestId,
        userId: userId || null,
        provider: provider || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_CONNECTIONS_WRITE_FAILED',
        message: 'Failed to disconnect provider',
        requestId: req.requestId
      });
    }
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
  const userId = String(req.user?.id || '').trim();
  const body = asObject(req.body);
  const email = normalizeAccountConnectionEmail(body.email || body.user_email || body.userEmail || '');
  const requestedTtlSec = toPositiveInt(body.ttl_sec || body.ttlSec, ACCOUNT_TELEGRAM_CODE_TTL_SEC);
  const ttlSec = Math.min(3600, Math.max(60, requestedTtlSec));

  if (!BOT_INTERNAL_API_BASE || !BOT_INTERNAL_LINK_SECRET) {
    const code = generateAccountTelegramCode();
    const expiresAtIso = new Date(Date.now() + (ttlSec * 1000)).toISOString();
    const store = loadAccountFallbackStore();
    store.telegram_link_codes.push({
      code,
      app_user_id: userId,
      email: email || null,
      expires_at: expiresAtIso,
      created_at: new Date().toISOString(),
      mode: 'local_fallback'
    });
    saveAccountFallbackStore(store);
    return res.json({
      ok: true,
      code,
      expires_at: expiresAtIso,
      ttl_sec: ttlSec,
      mode: 'local_fallback'
    });
  }

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
  if (storage.fallback) {
    try {
      const currentSession = touchAccountSessionFallback({ req, userId });
      const currentHash = String(currentSession?.current_hash || '').trim();
      const nowMs = Date.now();
      const store = loadAccountFallbackStore();
      const rows = store.sessions
        .filter((row) => (
          String(row.user_id || '') === userId
          && !row.revoked_at
          && Date.parse(String(row.expires_at || '')) > nowMs
        ))
        .sort((left, right) => Date.parse(String(right.last_active_at || 0)) - Date.parse(String(left.last_active_at || 0)))
        .slice(0, ACCOUNT_SESSIONS_LIST_LIMIT);
      return res.json(rows.map((row) => mapAccountSessionRow(row, currentHash)).filter(Boolean));
    } catch (error) {
      logError({
        type: 'account_sessions_fallback_read_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_SESSIONS_READ_FAILED',
        message: 'Failed to load sessions',
        requestId: req.requestId
      });
    }
  }
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
  if (storage.fallback) {
    try {
      const currentSession = touchAccountSessionFallback({ req, userId });
      const currentHash = String(currentSession?.current_hash || '').trim();
      const store = loadAccountFallbackStore();
      const target = store.sessions.find((row) => (
        String(row.id || '') === sessionId
        && String(row.user_id || '') === userId
      ));
      if (!target) {
        return res.status(404).json({
          status: 'error',
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
          requestId: req.requestId
        });
      }
      target.revoked_at = new Date().toISOString();
      saveAccountFallbackStore(store);
      const targetHash = String(target.session_token_hash || '').trim();
      const isCurrent = Boolean(currentHash && targetHash && currentHash === targetHash);
      log({
        type: 'account_session_revoked_fallback',
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
      logError({
        type: 'account_session_fallback_revoke_failed',
        requestId: req.requestId,
        userId: userId || null,
        sessionId: sessionId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_SESSIONS_WRITE_FAILED',
        message: 'Failed to revoke session',
        requestId: req.requestId
      });
    }
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
  if (storage.fallback) {
    try {
      touchAccountSessionFallback({ req, userId });
      const store = loadAccountFallbackStore();
      const nowIso = new Date().toISOString();
      let revokedCount = 0;
      for (const row of store.sessions) {
        if (String(row.user_id || '') !== userId) continue;
        if (row.revoked_at) continue;
        row.revoked_at = nowIso;
        revokedCount += 1;
      }
      saveAccountFallbackStore(store);
      log({
        type: 'account_logout_all_fallback',
        requestId: req.requestId,
        userId,
        revoked: revokedCount
      });
      return res.json({
        ok: true,
        revoked_count: revokedCount
      });
    } catch (error) {
      logError({
        type: 'account_logout_all_fallback_failed',
        requestId: req.requestId,
        userId: userId || null,
        error: error?.message || 'unknown'
      });
      return res.status(500).json({
        status: 'error',
        code: 'ACCOUNT_SESSIONS_WRITE_FAILED',
        message: 'Failed to logout all sessions',
        requestId: req.requestId
      });
    }
  }
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
  const rawUserId = String(req.user?.id || '').trim();
  const blockState = await resolveAccountBlockState(rawUserId, req.requestId);
  if (isTestModeUserId(rawUserId)) {
    const nowIso = new Date().toISOString();
    const planTier = normalizePlanTier(TEST_MODE_PLAN_TIER || 'team', 'team');
    const planTitle = planTier === 'team' ? 'Unlimited Test Plan' : formatPlanTitle(planTier);
    return res.json({
      user_id: rawUserId,
      plan: {
        tier: planTier,
        title: planTitle,
        status: 'active',
        renews_at: null,
        description: 'Local password test mode with full access',
        source: 'test_mode',
        promo_only: false
      },
      active_benefits: [
        {
          id: `test_mode_${rawUserId}`,
          kind: 'lifetime',
          scope: 'global',
          payload: {
            plan: planTier,
            lifetime: true,
            unlimited: true,
            test_mode: true
          },
          starts_at: nowIso,
          ends_at: null,
          revoked_at: null,
          is_active: true
        }
      ],
      promo_history: [],
      totals: {
        active_benefits: 1,
        redemptions: 0
      },
      access: {
        blocked: Boolean(blockState?.blocked),
        reason: blockState?.reason || null,
        blocked_at: blockState?.blocked_at || null
      },
      test_mode: true
    });
  }
  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    if (!ACCOUNT_STORAGE_FALLBACK_ENABLED) {
      return res.status(promoStorage.statusCode).json({
        status: 'error',
        code: promoStorage.code,
        message: promoStorage.message,
        requestId: req.requestId
      });
    }
    return res.json({
      plan: {
        tier: 'free',
        title: 'Free',
        status: 'active',
        renews_at: null,
        description: 'Fallback billing profile (promo storage unavailable)',
        promo_only: false
      },
      active_benefits: [],
      history: [],
      fallback: true,
      user_id: rawUserId || null,
      access: {
        blocked: Boolean(blockState?.blocked),
        reason: blockState?.reason || null,
        blocked_at: blockState?.blocked_at || null
      }
    });
  }

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
      },
      access: {
        blocked: Boolean(blockState?.blocked),
        reason: blockState?.reason || null,
        blocked_at: blockState?.blocked_at || null
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
    clearCachedAccountBlockState(rawUserId);
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

app.get('/account/workspaces', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const list = store.workspaces
      .filter((item) => Array.isArray(item.members) && item.members.some((member) => String(member.user_id || '') === userId))
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        role: workspaceMemberRole(item, userId),
        members_count: Array.isArray(item.members) ? item.members.length : 0,
        created_at: item.created_at,
        updated_at: item.updated_at || item.created_at
      }));
    return res.json({ ok: true, items: list });
  } catch (error) {
    logError({ type: 'account_workspaces_list_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_READ_FAILED', message: 'Failed to load workspaces', requestId: req.requestId });
  }
});

app.post('/account/workspaces', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const name = clampText(String(body.name || '').trim(), 120);
    if (!name) {
      return res.status(400).json({ status: 'error', code: 'MISSING_NAME', message: 'Workspace name is required', requestId: req.requestId });
    }
    const nowIso = new Date().toISOString();
    const workspace = {
      id: uuidv4(),
      name,
      description: clampText(String(body.description || '').trim(), 500) || '',
      members: [{ user_id: userId, role: 'owner', added_at: nowIso }],
      created_by: userId,
      created_at: nowIso,
      updated_at: nowIso
    };
    const store = loadWorkspacePlatformStore();
    store.workspaces.push(workspace);
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.create', { workspace_id: workspace.id, name: workspace.name });
    return res.status(201).json({ ok: true, item: workspace });
  } catch (error) {
    logError({ type: 'account_workspace_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to create workspace', requestId: req.requestId });
  }
});

app.patch('/account/workspaces/:id', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const index = store.workspaces.findIndex((item) => String(item.id || '') === workspaceId);
    if (index < 0) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    const current = store.workspaces[index];
    if (!canEditWorkspace(current, userId)) {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'No permission to update workspace', requestId: req.requestId });
    }
    const next = {
      ...current,
      name: body.name !== undefined ? clampText(String(body.name || '').trim(), 120) || current.name : current.name,
      description: body.description !== undefined ? clampText(String(body.description || '').trim(), 500) || '' : current.description,
      updated_at: new Date().toISOString()
    };
    store.workspaces[index] = next;
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.update', { workspace_id: workspaceId });
    return res.json({ ok: true, item: next });
  } catch (error) {
    logError({ type: 'account_workspace_update_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to update workspace', requestId: req.requestId });
  }
});

app.delete('/account/workspaces/:id', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const index = store.workspaces.findIndex((item) => String(item.id || '') === workspaceId);
    if (index < 0) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    const current = store.workspaces[index];
    if (workspaceMemberRole(current, userId) !== 'owner') {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'Only owner can delete workspace', requestId: req.requestId });
    }
    store.workspaces.splice(index, 1);
    store.projects = store.projects.filter((item) => String(item.workspace_id || '') !== workspaceId);
    store.folders = store.folders.filter((item) => String(item.workspace_id || '') !== workspaceId);
    store.items = store.items.filter((item) => String(item.workspace_id || '') !== workspaceId);
    store.comments = store.comments.filter((item) => String(item.workspace_id || '') !== workspaceId);
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.delete', { workspace_id: workspaceId });
    return res.json({ ok: true });
  } catch (error) {
    logError({ type: 'account_workspace_delete_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to delete workspace', requestId: req.requestId });
  }
});

app.post('/account/workspaces/:id/members', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const actor = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const targetUserId = clampText(String(body.user_id || '').trim(), 128);
    if (!targetUserId) return res.status(400).json({ status: 'error', code: 'MISSING_USER_ID', message: 'user_id is required', requestId: req.requestId });
    const role = normalizeWorkspaceRole(body.role);
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, actor);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    if (workspaceMemberRole(workspace, actor) !== 'owner') {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'Only owner can manage members', requestId: req.requestId });
    }
    const members = Array.isArray(workspace.members) ? workspace.members.slice() : [];
    const index = members.findIndex((item) => String(item.user_id || '') === targetUserId);
    if (index >= 0) {
      members[index] = { ...members[index], role };
    } else {
      members.push({ user_id: targetUserId, role, added_at: new Date().toISOString() });
    }
    workspace.members = members;
    workspace.updated_at = new Date().toISOString();
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.member.upsert', { workspace_id: workspaceId, target_user_id: targetUserId, role });
    return res.json({ ok: true, members: workspace.members });
  } catch (error) {
    logError({ type: 'account_workspace_member_upsert_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to update workspace members', requestId: req.requestId });
  }
});

app.delete('/account/workspaces/:id/members/:userId', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const actor = String(req.user?.id || '').trim();
    const target = String(req.params?.userId || '').trim();
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, actor);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    if (workspaceMemberRole(workspace, actor) !== 'owner') {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'Only owner can manage members', requestId: req.requestId });
    }
    workspace.members = (Array.isArray(workspace.members) ? workspace.members : []).filter((item) => String(item.user_id || '') !== target);
    workspace.updated_at = new Date().toISOString();
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.member.delete', { workspace_id: workspaceId, target_user_id: target });
    return res.json({ ok: true, members: workspace.members });
  } catch (error) {
    logError({ type: 'account_workspace_member_delete_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to remove workspace member', requestId: req.requestId });
  }
});

app.get('/account/workspaces/:id/items', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    const items = store.items.filter((item) => String(item.workspace_id || '') === workspaceId);
    const projects = store.projects.filter((item) => String(item.workspace_id || '') === workspaceId);
    const folders = store.folders.filter((item) => String(item.workspace_id || '') === workspaceId);
    return res.json({ ok: true, items, projects, folders });
  } catch (error) {
    logError({ type: 'account_workspace_items_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_READ_FAILED', message: 'Failed to load workspace items', requestId: req.requestId });
  }
});

app.post('/account/workspaces/:id/projects', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    if (!canEditWorkspace(workspace, userId)) {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'No permission to create project', requestId: req.requestId });
    }
    const item = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: clampText(String(body.name || '').trim(), 160) || 'Project',
      description: clampText(String(body.description || '').trim(), 500) || '',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.projects.push(item);
    saveWorkspacePlatformStore(store);
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    logError({ type: 'account_workspace_project_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to create project', requestId: req.requestId });
  }
});

app.post('/account/workspaces/:id/folders', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    if (!canEditWorkspace(workspace, userId)) {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'No permission to create folder', requestId: req.requestId });
    }
    const item = {
      id: uuidv4(),
      workspace_id: workspaceId,
      project_id: clampText(String(body.project_id || '').trim(), 120) || null,
      name: clampText(String(body.name || '').trim(), 160) || 'Folder',
      parent_id: clampText(String(body.parent_id || '').trim(), 120) || null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.folders.push(item);
    saveWorkspacePlatformStore(store);
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    logError({ type: 'account_workspace_folder_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to create folder', requestId: req.requestId });
  }
});

app.post('/account/workspaces/:id/items', requireUserAuth, (req, res) => {
  try {
    const workspaceId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    if (!canEditWorkspace(workspace, userId)) {
      return res.status(403).json({ status: 'error', code: 'WORKSPACE_FORBIDDEN', message: 'No permission to add items', requestId: req.requestId });
    }
    const item = {
      id: uuidv4(),
      workspace_id: workspaceId,
      project_id: clampText(String(body.project_id || '').trim(), 120) || null,
      folder_id: clampText(String(body.folder_id || '').trim(), 120) || null,
      name: clampText(String(body.name || '').trim(), 220) || 'file',
      input_key: clampText(String(body.input_key || '').trim(), 400) || null,
      output_key: clampText(String(body.output_key || '').trim(), 400) || null,
      size: Math.max(0, Number(body.size || 0)),
      format: clampText(String(body.format || '').trim().toLowerCase(), 32) || null,
      status: clampText(String(body.status || 'stored').trim().toLowerCase(), 40) || 'stored',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.items.push(item);
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'workspace.item.create', { workspace_id: workspaceId, item_id: item.id });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    logError({ type: 'account_workspace_item_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKSPACE_WRITE_FAILED', message: 'Failed to create workspace item', requestId: req.requestId });
  }
});

app.post('/ai/parse-intent', async (req, res) => {
  try {
    const body = asObject(req.body || {});
    const text = clampText(
      String(body.text || body.query || body.prompt || body.message || '').trim(),
      2000
    );
    if (!text) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_TEXT',
        message: 'Text query is required',
        requestId: req.requestId
      });
    }
    if (!GROQ_API_KEY) {
      return res.status(503).json({
        status: 'error',
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Groq API key is not configured',
        requestId: req.requestId
      });
    }

    let providerAttempt = await requestAiIntentFromGroq(text, { includeResponseFormat: true });
    let providerResponse = providerAttempt?.response || null;
    let providerPayload = providerAttempt?.body || null;
    let providerError = getAiProviderErrorMessage(providerPayload, providerResponse);

    if ((!providerResponse || !providerResponse.ok) && isAiResponseFormatUnsupported(providerResponse?.status, providerError)) {
      providerAttempt = await requestAiIntentFromGroq(text, { includeResponseFormat: false });
      providerResponse = providerAttempt?.response || null;
      providerPayload = providerAttempt?.body || null;
      providerError = getAiProviderErrorMessage(providerPayload, providerResponse);
    }

    if (!providerResponse || !providerResponse.ok) {
      logError({
        type: 'ai_parse_intent_provider_failed',
        requestId: req.requestId,
        status: providerResponse?.status || null,
        error: providerError
      });
      const fallbackIntent = normalizeAiIntentPayload({});
      return res.json({
        ok: true,
        intent: {
          ...fallbackIntent,
          tool: null
        },
        providerWarning: providerError,
        requestId: req.requestId
      });
    }

    const parsedRaw = extractAiIntentObject(providerPayload);
    if (!parsedRaw) {
      logError({
        type: 'ai_parse_intent_invalid_json',
        requestId: req.requestId,
        content: normalizeAiProviderText(providerPayload?.choices?.[0]?.message?.content).slice(0, 300)
      });
      const fallbackIntent = normalizeAiIntentPayload({});
      return res.json({
        ok: true,
        intent: {
          ...fallbackIntent,
          tool: null
        },
        providerWarning: 'invalid_json_response',
        requestId: req.requestId
      });
    }

    const intent = normalizeAiIntentPayload(parsedRaw);
    const tool = intent.from && intent.to
      ? resolveToolByFormats(intent.from, intent.to)
      : null;

    return res.json({
      ok: true,
      intent: {
        ...intent,
        tool
      },
      requestId: req.requestId
    });
  } catch (error) {
    if (String(error?.name || '') === 'AbortError') {
      return res.status(504).json({
        status: 'error',
        code: 'AI_PROVIDER_TIMEOUT',
        message: 'AI provider timeout',
        requestId: req.requestId
      });
    }
    logError({
      type: 'ai_parse_intent_failed',
      requestId: req.requestId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'AI_PARSE_INTENT_FAILED',
      message: 'Failed to parse intent',
      requestId: req.requestId
    });
  }
});

app.post('/account/file-intelligence/analyze', requireUserAuth, (req, res) => {
  try {
    const analysis = analyzeFileIntelligence({
      body: req.body,
      defaultGoal: 'convert'
    });
    if (!analysis.file.ext) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_EXTENSION',
        message: 'File extension is required',
        requestId: req.requestId
      });
    }
    const bestFormat = analysis.preset.target_format;
    const tool = analysis.preset.tool || resolveToolByFormats(analysis.file.ext, bestFormat) || null;
    return res.json({
      ok: true,
      analysis: {
        ...analysis.file,
        best_format: bestFormat,
        recommendation_reason: `Intent ${analysis.intent} matched ${analysis.file.category} profile`,
        estimated_output_size: analysis.preset.estimated_output_size,
        estimated_ratio: analysis.preset.estimated_ratio,
        recommended_tool: tool,
        recommended_settings: analysis.preset.settings,
        constraints: analysis.preset.constraints,
        actions: analysis.actions
      },
      requestId: req.requestId
    });
  } catch (error) {
    logError({ type: 'account_file_intelligence_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'FILE_INTELLIGENCE_FAILED', message: 'Failed to analyze file', requestId: req.requestId });
  }
});

app.post('/account/presets/generate', requireUserAuth, (req, res) => {
  try {
    const body = asObject(req.body || {});
    const analysis = analyzeFileIntelligence({
      body,
      defaultGoal: String(body.goal || body.intent || 'convert')
    });
    if (!analysis.file.ext) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_EXTENSION',
        message: 'File extension is required',
        requestId: req.requestId
      });
    }
    return res.json({
      ok: true,
      preset: {
        id: `preset_${analysis.intent}_${analysis.file.category}`,
        name: `${analysis.intent}:${analysis.file.category}`,
        intent: analysis.intent,
        tool: analysis.preset.tool,
        target_format: analysis.preset.target_format,
        settings: analysis.preset.settings,
        constraints: analysis.preset.constraints,
        rationale: analysis.preset.rationale
      },
      file: analysis.file,
      requestId: req.requestId
    });
  } catch (error) {
    logError({ type: 'account_preset_generate_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PRESET_GENERATE_FAILED', message: 'Failed to generate preset', requestId: req.requestId });
  }
});

app.post('/account/workflow/generate', requireUserAuth, (req, res) => {
  try {
    const body = asObject(req.body || {});
    const prompt = String(body.prompt || body.message || '').trim();
    const analysis = analyzeFileIntelligence({
      body,
      defaultGoal: String(prompt || body.goal || body.intent || 'convert')
    });
    if (!analysis.file.ext) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_EXTENSION',
        message: 'File extension is required',
        requestId: req.requestId
      });
    }
    const workflow = buildWorkflowFromIntelligence({
      analysis,
      prompt,
      name: String(body.name || body.workflow_name || body.pipeline_name || '').trim(),
      source: 'workflow_generator'
    });
    const shouldSave = body.save === true || body.auto_create_pipeline === true;
    let pipeline = null;
    if (shouldSave) {
      const userId = String(req.user?.id || '').trim();
      const nowIso = new Date().toISOString();
      const item = {
        id: uuidv4(),
        user_id: userId,
        workspace_id: clampText(String(body.workspace_id || '').trim(), 128) || null,
        name: workflow.name,
        source: workflow.source,
        prompt: workflow.prompt,
        intent: workflow.intent,
        steps: workflow.steps,
        nodes: workflow.nodes,
        edges: workflow.edges,
        enabled: body.enabled !== false,
        created_at: nowIso,
        updated_at: nowIso
      };
      const store = loadWorkspacePlatformStore();
      store.pipelines.push(item);
      saveWorkspacePlatformStore(store);
      pipeline = {
        ...item,
        summary: buildPipelineSummary(item)
      };
      appendAuditLog(req, 'pipeline.create.ai', {
        pipeline_id: item.id,
        nodes: workflow.nodes.length
      });
    }
    return res.json({
      ok: true,
      workflow,
      pipeline,
      requestId: req.requestId
    });
  } catch (error) {
    if (String(error?.code || '') === 'PIPELINE_GRAPH_CYCLE') {
      return res.status(400).json({
        status: 'error',
        code: 'PIPELINE_GRAPH_CYCLE',
        message: 'Workflow graph contains a cycle',
        requestId: req.requestId
      });
    }
    logError({ type: 'account_workflow_generate_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'WORKFLOW_GENERATE_FAILED', message: 'Failed to generate workflow', requestId: req.requestId });
  }
});

app.post('/account/assistant/respond', requireUserAuth, async (req, res) => {
  try {
    const body = asObject(req.body || {});
    const analysis = analyzeFileIntelligence({
      body,
      defaultGoal: String(body.goal || body.intent || body.prompt || body.message || 'convert')
    });
    if (!analysis.file.ext) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_EXTENSION',
        message: 'File extension is required',
        requestId: req.requestId
      });
    }
    const goal = analysis.intent;
    const fileName = String(analysis.file.name || body.file_name || body.fileName || 'input.bin').trim() || 'input.bin';
    const ext = analysis.file.ext;
    const fileSize = Math.max(0, Number(analysis.file.size_bytes || 0));
    const requestedTool = String(body.tool || '').trim();
    const requestedTargetFormat = String(body.target_format || body.targetFormat || '').trim().toLowerCase();
    const targetFormat = requestedTargetFormat || analysis.preset.target_format || ext || 'pdf';
    const resolvedTool = requestedTool || analysis.preset.tool || resolveToolByFormats(ext, targetFormat) || '';
    const normalizedTool = TOOL_IDS.has(resolvedTool) ? resolvedTool : null;
    const toolMeta = normalizedTool ? TOOL_META[normalizedTool] : null;
    const recommendedSettings = mergeSettingObjects(analysis.preset.settings, asObject(body.settings));
    const categoryCost = analysis.file.category === 'video'
      ? 1.6
      : analysis.file.category === 'document'
        ? 0.9
        : analysis.file.category === 'archive'
          ? 1.2
          : 0.7;
    const estimatedDurationSec = Math.max(3, Math.round((fileSize / (1024 * 1024)) * categoryCost + (goal === 'compress' ? 8 : 4)));
    const estimatedOutputSize = analysis.preset.estimated_output_size || (fileSize > 0 ? Math.max(1, Math.round(fileSize * 0.9)) : null);
    const workflow = buildWorkflowFromIntelligence({
      analysis: {
        ...analysis,
        preset: {
          ...analysis.preset,
          settings: recommendedSettings,
          target_format: targetFormat,
          tool: normalizedTool || analysis.preset.tool
        }
      },
      prompt: String(body.prompt || body.message || '').trim(),
      name: String(body.workflow_name || body.pipeline_name || '').trim(),
      source: 'assistant'
    });
    const assistantPipeline = workflow.steps.map((step) => ({
      step: step.action,
      status: 'planned',
      tool: step.tool || null
    }));

    const assistantMessage = normalizedTool
      ? `Recommended tool: ${normalizedTool}. Target format: ${targetFormat.toUpperCase()}.`
      : `Could not resolve tool automatically. Choose a conversion pair manually.`;

    const tools = [
      {
        name: 'recommend_settings',
        description: 'Return recommended conversion settings',
        args: {
          tool: normalizedTool,
          goal,
          target_format: targetFormat,
          settings: recommendedSettings,
          rationale: analysis.preset.rationale
        }
      },
      {
        name: 'estimate_job',
        description: 'Estimate duration and output size',
        args: {
          tool: normalizedTool,
          estimated_duration_sec: estimatedDurationSec,
          estimated_output_size: estimatedOutputSize
        }
      },
      {
        name: 'list_formats',
        description: 'List supported input formats for resolved tool',
        args: {
          tool: normalizedTool,
          inputs: toolMeta?.inputExts || [],
          output: normalizedTool ? TOOL_EXT[normalizedTool] || null : null
        }
      },
      {
        name: 'create_pipeline',
        description: 'Create reusable workflow pipeline in account',
        args: {
          name: workflow.name,
          nodes: workflow.nodes,
          edges: workflow.edges
        }
      },
      {
        name: 'create_job',
        description: 'Create conversion job with recommended settings',
        args: {
          tool: normalizedTool,
          target_format: targetFormat,
          settings: recommendedSettings,
          requires_input_key: true
        }
      },
      {
        name: 'get_job_status',
        description: 'Fetch status and progress by job id',
        args: {
          endpoint: '/jobs/:id'
        }
      },
      {
        name: 'explain_error',
        description: 'Explain conversion failures and suggest fallback strategy',
        args: {
          strategy: 'retry_with_alternative_engine',
          examples: ['re-encode ffmpeg', 'fallback libreoffice', 'fallback ghostscript']
        }
      }
    ];

    let pipeline = null;
    if (body.auto_create_pipeline === true) {
      const userId = String(req.user?.id || '').trim();
      const nowIso = new Date().toISOString();
      const item = {
        id: uuidv4(),
        user_id: userId,
        workspace_id: clampText(String(body.workspace_id || '').trim(), 128) || null,
        name: workflow.name,
        source: 'assistant',
        prompt: workflow.prompt,
        intent: workflow.intent,
        steps: workflow.steps,
        nodes: workflow.nodes,
        edges: workflow.edges,
        enabled: body.enabled !== false,
        created_at: nowIso,
        updated_at: nowIso
      };
      const store = loadWorkspacePlatformStore();
      store.pipelines.push(item);
      saveWorkspacePlatformStore(store);
      pipeline = {
        ...item,
        summary: buildPipelineSummary(item)
      };
      appendAuditLog(req, 'pipeline.create.assistant', {
        pipeline_id: item.id,
        intent: workflow.intent,
        nodes: workflow.nodes.length
      });
    }

    let job = null;
    if (body.auto_create_job === true) {
      if (!normalizedTool) {
        return res.status(400).json({
          status: 'error',
          code: 'ASSISTANT_TOOL_UNRESOLVED',
          message: 'Assistant could not resolve conversion tool',
          requestId: req.requestId
        });
      }
      const inputKey = String(body.input_key || body.inputKey || '').trim();
      if (!inputKey || !inputKey.startsWith('inputs/')) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_INPUT_KEY',
          message: 'input_key is required for auto_create_job',
          requestId: req.requestId
        });
      }
      if (storageMode === 's3') {
        const head = await headObject(inputKey);
        if (!head) {
          return res.status(404).json({
            status: 'error',
            code: 'INPUT_NOT_FOUND',
            message: 'Input not found',
            requestId: req.requestId
          });
        }
      } else {
        const diskPath = path.join(localRoot, inputKey);
        if (!fs.existsSync(diskPath)) {
          return res.status(404).json({
            status: 'error',
            code: 'INPUT_NOT_FOUND',
            message: 'Input not found',
            requestId: req.requestId
          });
        }
      }

      const jobId = uuidv4();
      const safeOriginalName = sanitizeFileName(String(body.original_name || body.originalName || fileName || 'input.bin'));
      const baseName = path.parse(safeOriginalName).name || 'output';
      const outputExt = TOOL_EXT[normalizedTool] || targetFormat || 'bin';
      const outputKey = `outputs/${jobId}/${baseName}.${outputExt}`;
      const timeout = TOOL_META[normalizedTool]?.timeoutMs || 180000;
      const requestedInputFormat = String(body.input_format || body.inputFormat || ext || '').trim().toLowerCase();
      const settingsForJob = {
        ...recommendedSettings,
        ...asObject(body.settings)
      };
      await withTimeout(queue.add('convert', {
        jobId,
        tool: normalizedTool,
        requestedTool: requestedTool || normalizedTool,
        fallbackApplied: false,
        inputKey,
        outputKey,
        originalName: safeOriginalName,
        settings: settingsForJob,
        inputFormat: requestedInputFormat,
        inputSize: fileSize || 0,
        requestId: req.requestId,
        userId: req.user?.id || null,
        automationApplied: [{ source: 'assistant', intent: goal, workflow: workflow.name }],
        pipeline: assistantPipeline,
        encryption: null
      }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
      job = {
        job_id: jobId,
        status: 'queued',
        tool: normalizedTool,
        output_key: outputKey,
        pipeline: assistantPipeline
      };
    }

    return res.json({
      ok: true,
      assistant: {
        message: assistantMessage,
        intent: goal,
        file: analysis.file,
        recommendation: {
          tool: normalizedTool,
          target_format: targetFormat,
          settings: recommendedSettings,
          constraints: analysis.preset.constraints,
          rationale: analysis.preset.rationale
        },
        estimates: {
          duration_sec: estimatedDurationSec,
          output_size: estimatedOutputSize
        },
        actions: analysis.actions,
        pipeline: assistantPipeline,
        workflow,
        tools
      },
      pipeline,
      job,
      requestId: req.requestId
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    if (String(error?.code || '') === 'PIPELINE_GRAPH_CYCLE') {
      return res.status(400).json({
        status: 'error',
        code: 'PIPELINE_GRAPH_CYCLE',
        message: 'Workflow graph contains a cycle',
        requestId: req.requestId
      });
    }
    logError({ type: 'account_assistant_respond_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({
      status: 'error',
      code: 'ASSISTANT_RESPONSE_FAILED',
      message: 'Failed to build assistant response',
      requestId: req.requestId
    });
  }
});

app.get('/account/pipelines', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const items = store.pipelines
      .filter((item) => String(item.user_id || '') === userId)
      .map((item) => {
        let compiled = null;
        try {
          compiled = compilePipelineDefinition(item, item);
        } catch (error) {
          const fallbackNodes = normalizeWorkflowNodes(item.nodes);
          compiled = {
            steps: normalizePipelineSteps(item.steps),
            nodes: fallbackNodes,
            edges: normalizeWorkflowEdges(item.edges, fallbackNodes)
          };
          logError({
            type: 'account_pipeline_compile_list_failed',
            pipeline_id: item.id || null,
            userId,
            error: error?.message || 'unknown'
          });
        }
        const pipeline = {
          ...item,
          steps: compiled.steps,
          nodes: compiled.nodes,
          edges: compiled.edges
        };
        return {
          ...pipeline,
          summary: buildPipelineSummary(pipeline)
        };
      });
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'account_pipelines_list_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PIPELINE_READ_FAILED', message: 'Failed to load pipelines', requestId: req.requestId });
  }
});

app.post('/account/pipelines', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const name = clampText(String(body.name || '').trim(), 160);
    if (!name) return res.status(400).json({ status: 'error', code: 'MISSING_NAME', message: 'Pipeline name is required', requestId: req.requestId });
    const compiled = compilePipelineDefinition(body, null);
    const pipeline = {
      id: uuidv4(),
      user_id: userId,
      workspace_id: clampText(String(body.workspace_id || '').trim(), 128) || null,
      name,
      source: clampText(String(body.source || 'manual').trim(), 40) || 'manual',
      prompt: clampText(String(body.prompt || '').trim(), 500) || null,
      intent: clampText(String(body.intent || '').trim(), 64) || null,
      steps: compiled.steps,
      nodes: compiled.nodes,
      edges: compiled.edges,
      enabled: body.enabled !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const store = loadWorkspacePlatformStore();
    store.pipelines.push(pipeline);
    saveWorkspacePlatformStore(store);
    const summary = buildPipelineSummary(pipeline);
    appendAuditLog(req, 'pipeline.create', {
      pipeline_id: pipeline.id,
      steps: summary.steps_total,
      nodes: summary.nodes_total
    });
    return res.status(201).json({ ok: true, item: { ...pipeline, summary } });
  } catch (error) {
    if (String(error?.code || '') === 'PIPELINE_GRAPH_CYCLE') {
      return res.status(400).json({
        status: 'error',
        code: 'PIPELINE_GRAPH_CYCLE',
        message: 'Workflow graph contains a cycle',
        requestId: req.requestId
      });
    }
    logError({ type: 'account_pipeline_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PIPELINE_WRITE_FAILED', message: 'Failed to create pipeline', requestId: req.requestId });
  }
});

app.patch('/account/pipelines/:id', requireUserAuth, (req, res) => {
  try {
    const pipelineId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const index = store.pipelines.findIndex((item) => String(item.id || '') === pipelineId && String(item.user_id || '') === userId);
    if (index < 0) return res.status(404).json({ status: 'error', code: 'PIPELINE_NOT_FOUND', message: 'Pipeline not found', requestId: req.requestId });
    const current = store.pipelines[index];
    const compiled = compilePipelineDefinition(body, current);
    const next = {
      ...current,
      name: body.name !== undefined ? clampText(String(body.name || '').trim(), 160) || current.name : current.name,
      source: body.source !== undefined ? clampText(String(body.source || '').trim(), 40) || current.source || 'manual' : current.source,
      prompt: body.prompt !== undefined ? clampText(String(body.prompt || '').trim(), 500) || null : current.prompt || null,
      intent: body.intent !== undefined ? clampText(String(body.intent || '').trim(), 64) || null : current.intent || null,
      steps: compiled.steps,
      nodes: compiled.nodes,
      edges: compiled.edges,
      enabled: body.enabled !== undefined ? body.enabled !== false : current.enabled,
      updated_at: new Date().toISOString()
    };
    store.pipelines[index] = next;
    saveWorkspacePlatformStore(store);
    return res.json({ ok: true, item: { ...next, summary: buildPipelineSummary(next) } });
  } catch (error) {
    if (String(error?.code || '') === 'PIPELINE_GRAPH_CYCLE') {
      return res.status(400).json({
        status: 'error',
        code: 'PIPELINE_GRAPH_CYCLE',
        message: 'Workflow graph contains a cycle',
        requestId: req.requestId
      });
    }
    logError({ type: 'account_pipeline_update_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PIPELINE_WRITE_FAILED', message: 'Failed to update pipeline', requestId: req.requestId });
  }
});

app.delete('/account/pipelines/:id', requireUserAuth, (req, res) => {
  try {
    const pipelineId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const before = store.pipelines.length;
    store.pipelines = store.pipelines.filter((item) => !(String(item.id || '') === pipelineId && String(item.user_id || '') === userId));
    if (store.pipelines.length === before) {
      return res.status(404).json({ status: 'error', code: 'PIPELINE_NOT_FOUND', message: 'Pipeline not found', requestId: req.requestId });
    }
    saveWorkspacePlatformStore(store);
    return res.json({ ok: true });
  } catch (error) {
    logError({ type: 'account_pipeline_delete_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PIPELINE_WRITE_FAILED', message: 'Failed to delete pipeline', requestId: req.requestId });
  }
});

app.post('/account/pipelines/:id/run', requireUserAuth, async (req, res) => {
  try {
    const pipelineId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const pipeline = store.pipelines.find((item) => String(item.id || '') === pipelineId && String(item.user_id || '') === userId);
    if (!pipeline) return res.status(404).json({ status: 'error', code: 'PIPELINE_NOT_FOUND', message: 'Pipeline not found', requestId: req.requestId });
    const compiled = compilePipelineDefinition(pipeline, pipeline);
    if (!Array.isArray(compiled.steps) || !compiled.steps.length) {
      return res.status(400).json({ status: 'error', code: 'PIPELINE_EMPTY', message: 'Pipeline has no executable steps', requestId: req.requestId });
    }
    const firstConvert = compiled.steps.find((step) => step.action === 'convert' && step.tool && TOOL_IDS.has(step.tool));
    if (!firstConvert) {
      return res.status(400).json({ status: 'error', code: 'PIPELINE_NO_CONVERT_STEP', message: 'Pipeline must include a valid convert step', requestId: req.requestId });
    }
    const inputKey = String(body.inputKey || '').trim();
    const originalName = String(body.originalName || 'input').trim();
    const inputSize = Number(body.inputSize || 0);
    const inputFormat = String(body.inputFormat || path.extname(originalName).replace('.', '')).trim().toLowerCase();
    if (!inputKey || !inputKey.startsWith('inputs/')) {
      return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Valid inputKey is required', requestId: req.requestId });
    }
    if (!inputSize || inputSize <= 0) {
      return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid inputSize', requestId: req.requestId });
    }
    if (inputSize > MAX_FILE_SIZE) {
      return res.status(413).json(fileTooLargePayload(req.requestId));
    }
    const jobId = uuidv4();
    const tool = firstConvert.tool;
    const availability = resolveToolAvailability(tool);
    if (!availability.allowed) {
      return res.status(503).json({ status: 'error', code: 'TOOL_TEMP_DISABLED', message: availability.reason || 'Tool temporarily disabled', requestId: req.requestId });
    }
    const finalTool = availability.tool;
    const outputName = `${path.parse(sanitizeFileName(originalName)).name || 'output'}.${TOOL_EXT[finalTool] || 'bin'}`;
    const outputKey = `outputs/${jobId}/${outputName}`;
    const timeout = TOOL_META[finalTool]?.timeoutMs || 180000;
    await withTimeout(queue.add('convert', {
      jobId,
      tool: finalTool,
      requestedTool: finalTool,
      fallbackApplied: availability.fallback_applied === true,
      inputKey,
      outputKey,
      originalName: sanitizeFileName(originalName),
      settings: asObject(firstConvert.settings || {}),
      inputFormat,
      inputSize,
      requestId: req.requestId,
      userId,
      pipelineId,
      pipeline: compiled.steps
    }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
    return res.json({
      ok: true,
      jobId,
      tool: finalTool,
      pipeline_id: pipelineId,
      steps_total: compiled.steps.length,
      nodes_total: compiled.nodes.length,
      edges_total: compiled.edges.length
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    if (String(error?.code || '') === 'PIPELINE_GRAPH_CYCLE') {
      return res.status(400).json({
        status: 'error',
        code: 'PIPELINE_GRAPH_CYCLE',
        message: 'Workflow graph contains a cycle',
        requestId: req.requestId
      });
    }
    logError({ type: 'account_pipeline_run_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'PIPELINE_RUN_FAILED', message: 'Failed to run pipeline', requestId: req.requestId });
  }
});

app.get('/account/automation-rules', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const items = store.automation_rules.filter((item) => String(item.user_id || '') === userId);
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'account_automation_rules_list_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'AUTOMATION_READ_FAILED', message: 'Failed to load automation rules', requestId: req.requestId });
  }
});

app.post('/account/automation-rules', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const rule = {
      id: uuidv4(),
      user_id: userId,
      name: clampText(String(body.name || '').trim(), 180) || 'Rule',
      enabled: body.enabled !== false,
      priority: Math.max(1, Number(body.priority || 100)),
      condition: asObject(body.condition || {}),
      action: asObject(body.action || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const store = loadWorkspacePlatformStore();
    store.automation_rules.push(rule);
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'automation_rule.create', { rule_id: rule.id });
    return res.status(201).json({ ok: true, item: rule });
  } catch (error) {
    logError({ type: 'account_automation_rule_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'AUTOMATION_WRITE_FAILED', message: 'Failed to create automation rule', requestId: req.requestId });
  }
});

app.patch('/account/automation-rules/:id', requireUserAuth, (req, res) => {
  try {
    const ruleId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const store = loadWorkspacePlatformStore();
    const index = store.automation_rules.findIndex((item) => String(item.id || '') === ruleId && String(item.user_id || '') === userId);
    if (index < 0) return res.status(404).json({ status: 'error', code: 'RULE_NOT_FOUND', message: 'Automation rule not found', requestId: req.requestId });
    const current = store.automation_rules[index];
    const next = {
      ...current,
      name: body.name !== undefined ? clampText(String(body.name || '').trim(), 180) || current.name : current.name,
      enabled: body.enabled !== undefined ? body.enabled !== false : current.enabled,
      priority: body.priority !== undefined ? Math.max(1, Number(body.priority || current.priority || 100)) : current.priority,
      condition: body.condition !== undefined ? asObject(body.condition || {}) : current.condition,
      action: body.action !== undefined ? asObject(body.action || {}) : current.action,
      updated_at: new Date().toISOString()
    };
    store.automation_rules[index] = next;
    saveWorkspacePlatformStore(store);
    return res.json({ ok: true, item: next });
  } catch (error) {
    logError({ type: 'account_automation_rule_update_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'AUTOMATION_WRITE_FAILED', message: 'Failed to update automation rule', requestId: req.requestId });
  }
});

app.delete('/account/automation-rules/:id', requireUserAuth, (req, res) => {
  try {
    const ruleId = String(req.params?.id || '').trim();
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const before = store.automation_rules.length;
    store.automation_rules = store.automation_rules.filter((item) => !(String(item.id || '') === ruleId && String(item.user_id || '') === userId));
    if (store.automation_rules.length === before) {
      return res.status(404).json({ status: 'error', code: 'RULE_NOT_FOUND', message: 'Automation rule not found', requestId: req.requestId });
    }
    saveWorkspacePlatformStore(store);
    return res.json({ ok: true });
  } catch (error) {
    logError({ type: 'account_automation_rule_delete_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'AUTOMATION_WRITE_FAILED', message: 'Failed to delete automation rule', requestId: req.requestId });
  }
});

app.get('/account/integrations', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const store = loadWorkspacePlatformStore();
    const items = store.integrations.filter((item) => String(item.user_id || '') === userId);
    return res.json({ ok: true, items });
  } catch (error) {
    logError({ type: 'account_integrations_list_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'INTEGRATION_READ_FAILED', message: 'Failed to load integrations', requestId: req.requestId });
  }
});

app.post('/account/integrations', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const provider = String(body.provider || '').trim().toLowerCase();
    const allowed = new Set(['google_drive', 'dropbox', 'notion', 'zapier']);
    if (!allowed.has(provider)) {
      return res.status(400).json({ status: 'error', code: 'INVALID_PROVIDER', message: 'Unsupported integration provider', requestId: req.requestId });
    }
    const store = loadWorkspacePlatformStore();
    const existing = store.integrations.find((item) => String(item.user_id || '') === userId && String(item.provider || '') === provider);
    if (existing) {
      existing.status = 'connected';
      existing.updated_at = new Date().toISOString();
      saveWorkspacePlatformStore(store);
      return res.json({ ok: true, item: existing });
    }
    const item = {
      id: uuidv4(),
      user_id: userId,
      provider,
      status: 'connected',
      metadata: asObject(body.metadata || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.integrations.push(item);
    saveWorkspacePlatformStore(store);
    appendAuditLog(req, 'integration.connect', { provider });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    logError({ type: 'account_integration_connect_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'INTEGRATION_WRITE_FAILED', message: 'Failed to connect integration', requestId: req.requestId });
  }
});

app.delete('/account/integrations/:provider', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const provider = String(req.params?.provider || '').trim().toLowerCase();
    const store = loadWorkspacePlatformStore();
    const before = store.integrations.length;
    store.integrations = store.integrations.filter((item) => !(String(item.user_id || '') === userId && String(item.provider || '') === provider));
    if (store.integrations.length === before) {
      return res.status(404).json({ status: 'error', code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found', requestId: req.requestId });
    }
    saveWorkspacePlatformStore(store);
    return res.json({ ok: true });
  } catch (error) {
    logError({ type: 'account_integration_delete_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'INTEGRATION_WRITE_FAILED', message: 'Failed to disconnect integration', requestId: req.requestId });
  }
});

app.get('/account/collaboration/comments', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const workspaceId = String(req.query?.workspace_id || '').trim();
    if (!workspaceId) return res.status(400).json({ status: 'error', code: 'MISSING_WORKSPACE_ID', message: 'workspace_id is required', requestId: req.requestId });
    const itemId = String(req.query?.item_id || '').trim();
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    const rows = store.comments.filter((row) => String(row.workspace_id || '') === workspaceId && (!itemId || String(row.item_id || '') === itemId));
    return res.json({ ok: true, items: rows });
  } catch (error) {
    logError({ type: 'account_comments_list_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'COLLAB_READ_FAILED', message: 'Failed to load comments', requestId: req.requestId });
  }
});

app.post('/account/collaboration/comments', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const body = asObject(req.body || {});
    const workspaceId = String(body.workspace_id || '').trim();
    const itemId = String(body.item_id || '').trim();
    const text = clampText(String(body.text || '').trim(), 4000);
    if (!workspaceId || !text) return res.status(400).json({ status: 'error', code: 'INVALID_INPUT', message: 'workspace_id and text are required', requestId: req.requestId });
    const store = loadWorkspacePlatformStore();
    const workspace = getWorkspaceById(store, workspaceId, userId);
    if (!workspace) return res.status(404).json({ status: 'error', code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found', requestId: req.requestId });
    const comment = {
      id: uuidv4(),
      workspace_id: workspaceId,
      item_id: itemId || null,
      user_id: userId,
      text,
      created_at: new Date().toISOString()
    };
    store.comments.push(comment);
    saveWorkspacePlatformStore(store);
    return res.status(201).json({ ok: true, item: comment });
  } catch (error) {
    logError({ type: 'account_comment_create_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'COLLAB_WRITE_FAILED', message: 'Failed to create comment', requestId: req.requestId });
  }
});

app.get('/account/insights/dashboard', requireUserAuth, (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const rangeDaysRaw = Number(req.query?.range_days || 30);
    const rangeDays = Math.max(1, Math.min(365, Number.isFinite(rangeDaysRaw) ? rangeDaysRaw : 30));
    const sinceTs = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
    const rows = loadWorkerJobResultsStore().filter((item) => String(item.user_id || '') === userId && Date.parse(String(item.created_at || '')) >= sinceTs);
    const total = rows.length;
    const success = rows.filter((item) => item.success === true).length;
    const avgDuration = total ? Math.round(rows.reduce((sum, row) => sum + Math.max(0, Number(row.duration_ms || 0)), 0) / total) : null;
    const tools = {};
    rows.forEach((row) => {
      const key = String(row.tool || 'unknown');
      tools[key] = Number(tools[key] || 0) + 1;
    });
    const store = loadWorkspacePlatformStore();
    const workspaceCount = store.workspaces.filter((item) => Array.isArray(item.members) && item.members.some((member) => String(member.user_id || '') === userId)).length;
    const itemCount = store.items.filter((item) => String(item.created_by || '') === userId).length;
    return res.json({
      ok: true,
      range_days: rangeDays,
      summary: {
        jobs_total: total,
        jobs_success: success,
        success_rate: total ? Number((success / total).toFixed(4)) : null,
        avg_time_to_result_ms: avgDuration
      },
      workspace: {
        workspaces: workspaceCount,
        files: itemCount
      },
      top_tools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tool, count]) => ({ tool, count }))
    });
  } catch (error) {
    logError({ type: 'account_insights_dashboard_failed', requestId: req.requestId, userId: req.user?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'INSIGHTS_READ_FAILED', message: 'Failed to load insights dashboard', requestId: req.requestId });
  }
});

app.get('/account/platform/capabilities', requireUserAuth, (_req, res) => {
  return res.json({
    ok: true,
    positioning: 'file_processing_platform',
    modules: [
      'file_workspace',
      'pipelines',
      'workflow_builder',
      'workflow_generator_ai',
      'file_intelligence',
      'collaboration',
      'bulk_processing',
      'smart_automation',
      'predictive_processing',
      'distributed_workers',
      'insights_dashboard',
      'integrations',
      'developer_ecosystem'
    ]
  });
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
const sendStoredFile = async (req, res) => {
  const rawKey = String(req.params?.[0] || '').trim();
  const decodedKey = rawKey.split('/').map((part) => safeDecodeURIComponent(part)).join('/');
  const key = normalizeStorageKey(decodedKey);
  if (!key) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_FILE_KEY',
      message: 'Invalid file key',
      requestId: req.requestId
    });
  }

  if (storageMode !== 's3') {
    const diskPath = path.join(localRoot, key);
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        requestId: req.requestId
      });
    }
    const inferred = inferContentTypeFromKey(key);
    if (inferred) res.setHeader('Content-Type', inferred);
    return res.sendFile(diskPath);
  }

  try {
    await ensureBucketAvailable();
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }));

    const contentType = response.ContentType || inferContentTypeFromKey(key);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (response.ContentDisposition) res.setHeader('Content-Disposition', response.ContentDisposition);
    if (response.ContentLength !== undefined && response.ContentLength !== null) {
      const contentLength = Number(response.ContentLength);
      if (Number.isFinite(contentLength) && contentLength >= 0) {
        res.setHeader('Content-Length', String(contentLength));
      }
    }
    if (response.ETag) res.setHeader('ETag', response.ETag);
    if (response.LastModified) res.setHeader('Last-Modified', new Date(response.LastModified).toUTCString());
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const body = response.Body;
    if (body && typeof body.pipe === 'function') {
      body.on('error', (streamError) => {
        logError({
          type: 'file_stream_failed',
          requestId: req.requestId,
          key,
          error: streamError?.message || 'unknown'
        });
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            code: 'FILE_STREAM_FAILED',
            message: 'Failed to stream file',
            requestId: req.requestId
          });
        } else {
          res.end();
        }
      });
      body.pipe(res);
      return;
    }

    if (body && typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      res.send(Buffer.from(bytes));
      return;
    }

    if (Buffer.isBuffer(body)) {
      res.send(body);
      return;
    }

    return res.status(500).json({
      status: 'error',
      code: 'FILE_BODY_UNAVAILABLE',
      message: 'File body unavailable',
      requestId: req.requestId
    });
  } catch (error) {
    const code = String(error?.name || error?.Code || '').trim();
    if (code === 'NoSuchKey' || code === 'NotFound' || code === 'NoSuchBucket') {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        requestId: req.requestId
      });
    }
    logError({
      type: 'file_fetch_failed',
      requestId: req.requestId,
      key,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'FILE_FETCH_FAILED',
      message: 'Failed to fetch file',
      requestId: req.requestId
    });
  }
};

app.get('/api/files/*', (req, res) => {
  void sendStoredFile(req, res);
});
app.get('/files/*', (req, res) => {
  void sendStoredFile(req, res);
});

app.post('/crypto/session', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    if (!isUnlimitedTestRequest(req)) {
      const clientId = getClientId(req);
      const allowed = await rateLimit(`rl:crypto:${clientId}`, 30, 60);
      if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many requests', requestId: req.requestId });
    }

    const sessionId = uuidv4();
    const kp = nacl.box.keyPair();
    await withTimeout(connection.setex(`zk:session:${sessionId}`, ZK_SESSION_TTL_SEC, bytesToB64(kp.secretKey)), REDIS_OP_TIMEOUT_MS, 'redis_setex_timeout');
    return res.json({
      sessionId,
      publicKey: bytesToB64(kp.publicKey),
      expiresIn: ZK_SESSION_TTL_SEC,
      keyVersion: ENCRYPTION_KEY_VERSION,
      algorithm: 'AES-256-GCM'
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'redis_unavailable'));
    }
    logError({ type: 'crypto_session_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'SESSION_CREATE_FAILED', message: 'Failed to create crypto session', requestId: req.requestId });
  }
});

app.get('/security/encryption-profile', (_req, res) => {
  return res.json({
    ok: true,
    profile: {
      in_transit: {
        tls_required: true,
        hsts_enabled: HSTS_ENABLED,
        hsts_max_age: HSTS_MAX_AGE
      },
      at_rest: {
        algorithm: 'AES-256-GCM',
        envelope_encryption: true,
        key_version: ENCRYPTION_KEY_VERSION
      },
      private_mode: {
        client_side_encryption_supported: true,
        session_ttl_sec: ZK_SESSION_TTL_SEC,
        auto_delete_hours: 24
      }
    }
  });
});

app.get('/crypto/worker-pubkey', (req, res) => {
  const pub = process.env.WORKER_KEY_PUBLIC;
  if (!pub) return res.status(500).json({ status: 'error', code: 'MISSING_WORKER_KEY', message: 'Worker public key not configured', requestId: req.requestId });
  res.json({ publicKey: pub });
});

app.post('/uploads/resolve-hash', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const body = asObject(req.body || {});
    const sha256 = normalizeSha256(body.sha256 || req.headers['x-file-sha256']);
    if (!sha256) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_SHA256',
        message: 'sha256 is required',
        requestId: req.requestId
      });
    }
    const inputKey = await resolveInputKeyByHash(sha256);
    return res.json({
      ok: true,
      found: Boolean(inputKey),
      inputKey: inputKey || null,
      source: inputKey ? 'hash_cache' : null,
      requestId: req.requestId
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'redis_unavailable'));
    }
    logError({ type: 'upload_hash_resolve_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({
      status: 'error',
      code: 'UPLOAD_HASH_RESOLVE_FAILED',
      message: 'Failed to resolve upload hash',
      requestId: req.requestId
    });
  }
});

app.post('/uploads/register-hash', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    const body = asObject(req.body || {});
    const sha256 = normalizeSha256(body.sha256 || req.headers['x-file-sha256']);
    const inputKey = String(body.inputKey || body.input_key || '').trim();
    if (!sha256) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_SHA256',
        message: 'sha256 is required',
        requestId: req.requestId
      });
    }
    if (!inputKey || !inputKey.startsWith('inputs/')) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_INPUT_KEY',
        message: 'inputKey is required',
        requestId: req.requestId
      });
    }
    if (storageMode === 's3') {
      const head = await headObject(inputKey);
      if (!head) {
        return res.status(404).json({
          status: 'error',
          code: 'INPUT_NOT_FOUND',
          message: 'Input not found',
          requestId: req.requestId
        });
      }
    } else {
      const diskPath = path.join(localRoot, inputKey);
      if (!fs.existsSync(diskPath)) {
        return res.status(404).json({
          status: 'error',
          code: 'INPUT_NOT_FOUND',
          message: 'Input not found',
          requestId: req.requestId
        });
      }
    }
    await rememberInputKeyHash(sha256, inputKey);
    return res.json({ ok: true, sha256, inputKey, requestId: req.requestId });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'redis_unavailable'));
    }
    logError({ type: 'upload_hash_register_failed', requestId: req.requestId, error: error?.message || 'unknown' });
    return res.status(500).json({
      status: 'error',
      code: 'UPLOAD_HASH_REGISTER_FAILED',
      message: 'Failed to register upload hash',
      requestId: req.requestId
    });
  }
});

app.post('/uploads/sign', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    if (!isUnlimitedTestRequest(req)) {
      const clientId = getClientId(req);
      const allowed = await rateLimit(`rl:upload:${clientId}`, RATE_LIMIT_UPLOADS_PER_MIN, 60);
      if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many uploads', requestId: req.requestId });
    }

    if (storageMode !== 's3') {
      return res.status(400).json({ status: 'error', code: 'STORAGE_NOT_S3', message: 'Presigned upload requires S3-compatible storage', requestId: req.requestId });
    }
    await ensureBucketAvailable();
    const { filename, contentType, size } = req.body || {};
    if (!filename) return res.status(400).json({ status: 'error', code: 'MISSING_FILENAME', message: 'Missing filename', requestId: req.requestId });
    if (!size || Number(size) <= 0) return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    if (Number(size) > MAX_FILE_SIZE) return res.status(413).json(fileTooLargePayload(req.requestId));

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

app.post('/uploads/proxy', express.raw({ type: '*/*', limit: `${MAX_FILE_SIZE_MB}mb` }), async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    if (!isUnlimitedTestRequest(req)) {
      const clientId = getClientId(req);
      const allowed = await rateLimit(`rl:upload:${clientId}`, RATE_LIMIT_UPLOADS_PER_MIN, 60);
      if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many uploads', requestId: req.requestId });
    }

    if (storageMode !== 's3') {
      return res.status(400).json({ status: 'error', code: 'STORAGE_NOT_S3', message: 'Proxy upload requires S3-compatible storage', requestId: req.requestId });
    }
    await ensureBucketAvailable();

    const inputKey = String(req.headers['x-input-key'] || '').trim();
    const providedSha256 = normalizeSha256(req.headers['x-file-sha256']);
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
      return res.status(413).json(fileTooLargePayload(req.requestId));
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

    let resolvedSha = providedSha256;
    if (!resolvedSha && body.length > 0 && body.length <= UPLOAD_HASH_COMPUTE_MAX_BYTES) {
      try {
        resolvedSha = crypto.createHash('sha256').update(body).digest('hex');
      } catch {
        resolvedSha = '';
      }
    }
    if (resolvedSha) {
      await rememberInputKeyHash(resolvedSha, inputKey);
    }

    return res.json({ ok: true, inputKey, sha256: resolvedSha || null, requestId: req.requestId });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'redis_unavailable'));
    }
    logError({ type: 'upload_proxy_failed', requestId: req.requestId, error: err.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'UPLOAD_PROXY_FAILED', message: 'Failed proxy upload', requestId: req.requestId });
  }
});

app.post('/auth/test-mode/login', (req, res) => {
  if (!isTestModeConfigured()) {
    return res.status(503).json({
      status: 'error',
      code: 'TEST_MODE_DISABLED',
      message: 'Test mode is disabled',
      requestId: req.requestId
    });
  }
  if (!isTestModeRequestAllowed(req)) {
    return res.status(403).json({
      status: 'error',
      code: 'TEST_MODE_FORBIDDEN',
      message: 'Test mode is allowed only from localhost',
      requestId: req.requestId
    });
  }

  const body = asObject(req.body);
  const password = String(body.password || '').trim();
  if (!password) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_PASSWORD',
      message: 'Missing test mode password',
      requestId: req.requestId
    });
  }
  if (!timingSafeEqualText(password, TEST_MODE_PASSWORD)) {
    return res.status(401).json({
      status: 'error',
      code: 'TEST_MODE_UNAUTHORIZED',
      message: 'Invalid test mode password',
      requestId: req.requestId
    });
  }

  const requestedUid = String(body.user_id || body.userId || '').trim();
  const userId = isTestModeUserId(requestedUid)
    ? requestedUid
    : buildTestModeUserId(body.login || body.username || body.email || '');
  const alias = sanitizeTestModeAlias(body.login || body.username || body.email || userId) || userId;
  const displayName = (
    String(body.display_name || body.displayName || `Test ${alias}`)
      .trim()
      .slice(0, 80)
    || `Test ${alias}`
  );
  const userEmailAlias = sanitizeTestModeAlias(body.email || alias) || alias;
  const email = `${userEmailAlias}@test.local`;
  const planTier = normalizePlanTier(TEST_MODE_PLAN_TIER || 'team', 'team');
  const planTitle = planTier === 'team' ? 'Unlimited Test Plan' : formatPlanTitle(planTier);

  return res.json({
    ok: true,
    user: {
      uid: userId,
      name: displayName,
      email,
      isAnon: false,
      is_test_mode: true,
      provider_data: [
        {
          provider_id: 'test_mode',
          uid: userId,
          email
        }
      ]
    },
    plan: {
      tier: planTier,
      title: planTitle,
      status: 'active',
      description: 'Local password test mode with full access',
      renews_at: null,
      source: 'test_mode',
      promo_only: false
    }
  });
});

app.post('/auth/test-mode/unlock', async (req, res) => {
  if (!isTestModeConfigured()) {
    return res.status(503).json({
      status: 'error',
      code: 'TEST_MODE_DISABLED',
      message: 'Test mode is disabled',
      requestId: req.requestId
    });
  }
  if (!isTestModeRequestAllowed(req)) {
    return res.status(403).json({
      status: 'error',
      code: 'TEST_MODE_FORBIDDEN',
      message: 'Test mode is allowed only from localhost',
      requestId: req.requestId
    });
  }

  const body = asObject(req.body);
  const rawUserId = String(body.user_id || body.userId || getRequestUserId(req) || '').trim();
  if (!isTestModeUserId(rawUserId)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_TEST_MODE_USER',
      message: 'Invalid test mode user id',
      requestId: req.requestId
    });
  }

  const promoStorage = getPromoStorageStatus();
  if (!promoStorage.ok) {
    return res.status(promoStorage.statusCode).json({
      status: 'error',
      code: promoStorage.code,
      message: promoStorage.message,
      requestId: req.requestId
    });
  }

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
    const activeEntitlementsResult = await promoStorage.pool.query(
      `
        SELECT id, kind, scope, payload, starts_at, ends_at, revoked_at
        FROM user_entitlements
        WHERE user_id = $1
          AND kind = 'feature_access'
          AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [promoUserId]
    );
    const nowMs = Date.now();
    const blockedEntitlementIds = activeEntitlementsResult.rows
      .map((row) => mapEntitlementRow(row))
      .filter((item) => isAccountBlockEntitlement(item, nowMs))
      .map((item) => item.id)
      .filter(Boolean);

    let revokedCount = 0;
    if (blockedEntitlementIds.length > 0) {
      const revokeResult = await promoStorage.pool.query(
        `
          UPDATE user_entitlements
          SET revoked_at = now()
          WHERE id = ANY($1::uuid[])
            AND revoked_at IS NULL
          RETURNING id
        `,
        [blockedEntitlementIds]
      );
      revokedCount = Number(revokeResult.rowCount || 0);
    }

    clearCachedAccountBlockState(rawUserId);
    const blockState = await resolveAccountBlockState(rawUserId, req.requestId);
    log({
      type: 'test_mode_unlock_account',
      requestId: req.requestId,
      userId: rawUserId,
      promoUserId,
      revokedCount,
      stillBlocked: Boolean(blockState?.blocked)
    });

    return res.json({
      ok: true,
      user_id: rawUserId,
      promo_user_id: promoUserId,
      revoked_count: revokedCount,
      access: {
        blocked: Boolean(blockState?.blocked),
        reason: blockState?.reason || null,
        blocked_at: blockState?.blocked_at || null
      }
    });
  } catch (error) {
    logError({
      type: 'test_mode_unlock_failed',
      requestId: req.requestId,
      userId: rawUserId,
      promoUserId,
      error: error?.message || 'unknown'
    });
    return res.status(500).json({
      status: 'error',
      code: 'TEST_MODE_UNLOCK_FAILED',
      message: 'Failed to unlock test mode account',
      requestId: req.requestId
    });
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

app.use('/api', requireApiKeyAuth, enforceApiKeyLimits, apiKeyUsageTracker);

app.get('/api/keys/me', (req, res) => {
  return res.json({ ok: true, api_key: mapApiKeyPublic(req.apiKey) });
});

app.post('/api/uploads/sign', async (req, res) => {
  try {
    const body = asObject(req.body || {});
    const originalName = sanitizeFileName(String(body.fileName || body.originalName || 'upload.bin'));
    const contentType = String(body.contentType || 'application/octet-stream');
    const key = `inputs/${uuidv4()}/${originalName}`;
    if (storageMode === 's3') {
      const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: contentType
      }), { expiresIn: 15 * 60 });
      return res.json({
        ok: true,
        key,
        inputKey: key,
        uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': contentType }
      });
    }
    return res.json({
      ok: true,
      key,
      inputKey: key,
      uploadUrl: `/api/uploads/proxy?key=${encodeURIComponent(key)}`,
      method: 'POST'
    });
  } catch (error) {
    logError({ type: 'api_upload_sign_failed', requestId: req.requestId, apiKeyId: req.apiKey?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'UPLOAD_SIGN_FAILED', message: 'Failed to sign upload URL', requestId: req.requestId });
  }
});

app.post('/api/convert', conversionRateLimitMiddleware, async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) return res.status(503).json(redis.payload);

    const body = asObject(req.body || {});
    const apiEncryption = asObject(body.encryption || {});
    if (apiEncryption.enabled === true) {
      const envelopeCheck = validateEncryptionEnvelope(apiEncryption, { requireKeyWrap: true });
      if (!envelopeCheck.ok) {
        return res.status(400).json({ status: 'error', code: envelopeCheck.code, message: envelopeCheck.message, requestId: req.requestId });
      }
      const metaCheck = validateEncryptionMeta(apiEncryption);
      if (!metaCheck.ok) {
        return res.status(400).json({ status: 'error', code: metaCheck.code, message: metaCheck.message, requestId: req.requestId });
      }
    }
    const requestedTool = String(body.tool || '').trim();
    let tool = requestedTool;
    let inputKey = String(body.input_key || body.inputKey || '').trim();
    let originalName = String(body.original_name || body.originalName || 'input.bin').trim();
    let inputFormat = String(body.input_format || body.inputFormat || '').trim().toLowerCase();
    let inputSize = Number(body.input_size || body.inputSize || 0);

    if (!inputKey && body.file_url && body.to_format) {
      const fileUrl = String(body.file_url || '').trim();
      const toFormat = String(body.to_format || '').trim().toLowerCase();
      const response = await fetch(fileUrl, { method: 'GET' });
      if (!response.ok) {
        return res.status(400).json({ status: 'error', code: 'FILE_FETCH_FAILED', message: 'Unable to fetch file_url', requestId: req.requestId });
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (!buffer.length) {
        return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
      }
      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(413).json(fileTooLargePayload(req.requestId));
      }
      const ext = inferExtFromUrl(fileUrl) || 'bin';
      if (!tool) {
        tool = resolveToolByFormats(ext, toFormat) || '';
      }
      if (!tool) {
        return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TOOL', message: 'Cannot resolve tool by file_url/to_format', requestId: req.requestId });
      }
      const generatedName = `remote.${ext}`;
      inputKey = `inputs/${uuidv4()}/${generatedName}`;
      await putObjectBuffer(inputKey, buffer, String(response.headers.get('content-type') || 'application/octet-stream'));
      originalName = generatedName;
      inputFormat = ext;
      inputSize = buffer.length;
    }

    if (!tool || !TOOL_IDS.has(tool)) {
      return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TOOL', message: 'Unsupported tool', requestId: req.requestId });
    }
    const availability = resolveToolAvailability(tool);
    if (!availability.allowed) {
      return res.status(503).json({
        status: 'error',
        code: 'TOOL_TEMP_DISABLED',
        message: availability.reason || 'Tool temporarily disabled',
        tool,
        requestId: req.requestId
      });
    }
    const requestedToolId = tool;
    tool = availability.tool;
    if (!inputKey || !String(inputKey).startsWith('inputs/')) {
      return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Missing input key', requestId: req.requestId });
    }

    const safeName = sanitizeFileName(originalName || 'input');
    const toolMeta = TOOL_META[tool];
    const inferredInputFormat = inputFormat || path.extname(safeName).replace('.', '').toLowerCase();
    if (toolMeta?.inputExts?.length && !toolMeta.inputExts.includes(inferredInputFormat)) {
      return res.status(400).json({ status: 'error', code: 'INVALID_FORMAT', message: 'Unsupported input format', requestId: req.requestId });
    }
    const size = Number(inputSize || 0);
    if (!size || size <= 0) {
      return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    }
    if (size > MAX_FILE_SIZE) {
      return res.status(413).json(fileTooLargePayload(req.requestId));
    }

    const jobId = uuidv4();
    const base = path.parse(safeName).name || 'output';
    const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
    const outputName = `${base}.${ext}`;
    const outputKey = `outputs/${jobId}/${outputName}`;
    const timeout = toolMeta?.timeoutMs || 180000;
    await withTimeout(queue.add('convert', {
      jobId,
      tool,
      requestedTool: requestedToolId,
      fallbackApplied: availability.fallback_applied === true,
      inputKey,
      outputKey,
      originalName: safeName,
      settings: asObject(body.settings || {}),
      inputFormat: inferredInputFormat,
      inputSize: size,
      requestId: req.requestId,
      apiKeyId: req.apiKey.id,
      encryption: apiEncryption.enabled === true ? apiEncryption : null
    }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
    return res.status(202).json({
      ok: true,
      jobId,
      job_id: jobId,
      status: 'queued',
      tool,
      requested_tool: requestedToolId,
      fallback_applied: availability.fallback_applied === true,
      requestId: req.requestId
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    logError({ type: 'api_convert_failed', requestId: req.requestId, apiKeyId: req.apiKey?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'API_CONVERT_FAILED', message: 'Failed to create conversion job', requestId: req.requestId });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) return res.status(503).json(redis.payload);
    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found', requestId: req.requestId });
    const jobApiKeyId = String(job?.data?.apiKeyId || '');
    if (jobApiKeyId && jobApiKeyId !== String(req.apiKey?.id || '')) {
      return res.status(404).json({ status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found', requestId: req.requestId });
    }
    const state = await job.getState();
    const progressPayload = normalizeJobProgressPayload(job.progress);
    const progress = progressPayload.progress;
    let downloadUrl = null;
    if (state === 'completed') {
      const outputKey = (job.returnvalue && job.returnvalue.outputKey) || job.data.outputKey;
      downloadUrl = buildDownloadUrl(req, outputKey);
    }
    if (jobApiKeyId && (state === 'completed' || state === 'failed')) {
      const eventName = state === 'completed' ? 'job.completed' : 'job.failed';
      void dispatchApiWebhooks({
        apiKeyId: jobApiKeyId,
        eventName,
        payload: {
          job_id: String(req.params.id || ''),
          status: state,
          download_url: downloadUrl,
          error: state === 'failed' ? (job.failedReason || 'Conversion failed') : null
        }
      }).catch((error) => {
        logError({
          type: 'api_webhook_dispatch_failed',
          requestId: req.requestId,
          apiKeyId: jobApiKeyId,
          jobId: req.params.id,
          eventName,
          error: error?.message || 'unknown'
        });
      });
    }
    const errorMessage = state === 'failed' ? (job.failedReason || 'Conversion failed') : null;
    return res.json({
      ok: true,
      jobId: req.params.id,
      job_id: req.params.id,
      status: state,
      progress,
      itemProgress: progressPayload.itemProgress,
      item_progress: progressPayload.itemProgress,
      downloadUrl,
      download_url: downloadUrl,
      error: errorMessage,
      error_detail: errorMessage ? { message: errorMessage } : null
    });
  } catch (error) {
    if (isQueueUnavailableError(error)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
    }
    logError({ type: 'api_job_fetch_failed', requestId: req.requestId, apiKeyId: req.apiKey?.id || null, error: error?.message || 'unknown' });
    return res.status(500).json({ status: 'error', code: 'JOB_FETCH_FAILED', message: 'Failed to fetch job', requestId: req.requestId });
  }
});

app.post('/jobs', conversionRateLimitMiddleware, async (req, res) => {
  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }
    if (!isUnlimitedTestRequest(req)) {
      const clientId = getClientId(req);
      const allowed = await rateLimit(`rl:jobs:${clientId}`, RATE_LIMIT_JOBS_PER_MIN, 60);
      if (!allowed) return res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many jobs', requestId: req.requestId });
    }

    const requestBody = asObject(req.body || {});
    const scopeKey = getJobScopeKey(req);
    const idempotencyKey = normalizeJobIdempotencyKey(req, requestBody);
    if (idempotencyKey) {
      const cached = await readJobIdempotencyResult(scopeKey, idempotencyKey);
      if (cached?.jobId) {
        return res.json({
          ...cached,
          idempotency_reused: true,
          requestId: req.requestId
        });
      }
    }

    const requestedTool = String(requestBody.tool || '').trim();
    let tool = requestedTool;
    const batch = String(requestBody.batch || 'false') === 'true';
    let settings = {};
    if (typeof requestBody.settings === 'string') {
      try {
        settings = asObject(JSON.parse(requestBody.settings));
      } catch {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_SETTINGS',
          message: 'settings must be valid JSON object',
          requestId: req.requestId
        });
      }
    } else {
      settings = asObject(requestBody.settings);
    }
    const actorUserId = getRequestUserId(req);
    if (!tool) return res.status(400).json({ status: 'error', code: 'MISSING_TOOL', message: 'Missing tool', requestId: req.requestId });
    if (!TOOL_IDS.has(tool)) return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TOOL', message: 'Unsupported tool', requestId: req.requestId });
    const availability = resolveToolAvailability(tool);
    if (!availability.allowed) {
      return res.status(503).json({
        status: 'error',
        code: 'TOOL_TEMP_DISABLED',
        message: availability.reason || 'Tool temporarily disabled',
        tool,
        requestId: req.requestId
      });
    }
    tool = availability.tool;

    const jobId = uuidv4();
    const toolMeta = TOOL_META[tool];
    const timeout = toolMeta?.timeoutMs || 180000;
    const encryption = asObject(requestBody.encryption);
    if (encryption?.enabled) {
      const envelopeCheck = validateEncryptionEnvelope(encryption, { requireKeyWrap: true });
      if (!envelopeCheck.ok) {
        return res.status(400).json({ status: 'error', code: envelopeCheck.code, message: envelopeCheck.message, requestId: req.requestId });
      }
      const sessionId = encryption.sessionId;
      if (!sessionId) return res.status(400).json({ status: 'error', code: 'MISSING_SESSION', message: 'Missing encryption session', requestId: req.requestId });
      const exists = await withTimeout(connection.exists(`zk:session:${sessionId}`), REDIS_OP_TIMEOUT_MS, 'redis_exists_timeout');
      if (!exists) return res.status(400).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Encryption session expired', requestId: req.requestId });
      const refreshed = await withTimeout(connection.expire(`zk:session:${sessionId}`, ZK_SESSION_TTL_SEC), REDIS_OP_TIMEOUT_MS, 'redis_expire_timeout');
      if (!refreshed) return res.status(400).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Encryption session expired', requestId: req.requestId });
    }

    if (batch) {
      const inputItems = [];
      const incomingItems = Array.isArray(requestBody.items) ? requestBody.items : [];
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
        if (inputSize > MAX_FILE_SIZE) return res.status(413).json(fileTooLargePayload(req.requestId));
        if (toolMeta?.inputExts?.length && !toolMeta.inputExts.includes(inputFormat)) {
          return res.status(400).json({ status: 'error', code: 'INVALID_FORMAT', message: 'Unsupported input format', requestId: req.requestId });
        }
        if (encryption?.enabled) {
          const metaCheck = validateEncryptionMeta(item.encryption);
          if (!metaCheck.ok) {
            return res.status(400).json({ status: 'error', code: metaCheck.code, message: metaCheck.message, requestId: req.requestId });
          }
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
          encryption: item.encryption || null,
          checksum: extractChecksumValue(item.checksum || item.inputHash || item.input_hash) || null
        });
      }

      const batchInputSize = inputItems.reduce((sum, i) => sum + (i.inputSize || 0), 0);
      const dedupeSignature = buildJobDedupeSignature({
        tool,
        settings,
        checksums: inputItems.map((item) => item.checksum).filter(Boolean),
        batch: true,
        inputSize: batchInputSize
      });
      if (dedupeSignature) {
        const dedupeJobId = await readJobDedupeJobId(scopeKey, dedupeSignature);
        if (dedupeJobId) {
          const existingJob = await queue.getJob(dedupeJobId);
          if (existingJob) {
            const payload = {
              jobId: dedupeJobId,
              tool,
              requested_tool: requestedTool,
              fallback_applied: availability.fallback_applied === true,
              dedupe_reused: true,
              requestId: req.requestId
            };
            if (idempotencyKey) {
              await writeJobIdempotencyResult(scopeKey, idempotencyKey, payload);
            }
            return res.json(payload);
          }
        }
      }

      const automationApplied = applyAutomationRulesForJob({
        userId: actorUserId,
        tool,
        inputSize: batchInputSize,
        settings
      });
      tool = automationApplied.tool;
      settings = automationApplied.settings;
      const batchOutputKey = `outputs/${jobId}/batch_${tool}.zip`;
      await withTimeout(queue.add('convert', {
        jobId,
        tool,
        requestedTool,
        fallbackApplied: availability.fallback_applied === true,
        batch: true,
        items: inputItems,
        outputKey: batchOutputKey,
        settings,
        inputFormats: inputItems.map((i) => i.inputFormat).filter(Boolean),
        inputSize: batchInputSize,
        requestId: req.requestId,
        userId: actorUserId || null,
        automationApplied: automationApplied.matched_rules,
        encryption
      }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
      log({ type: 'job_created', requestId: req.requestId, jobId, tool, requestedTool, fallbackApplied: availability.fallback_applied === true, batch: true, count: inputItems.length });
      const payload = {
        jobId,
        tool,
        requested_tool: requestedTool,
        fallback_applied: availability.fallback_applied === true,
        requestId: req.requestId
      };
      if (dedupeSignature) {
        await writeJobDedupeJobId(scopeKey, dedupeSignature, jobId);
      }
      if (idempotencyKey) {
        await writeJobIdempotencyResult(scopeKey, idempotencyKey, payload);
      }
      return res.json(payload);
    }

    const inputKey = requestBody.inputKey;
    const originalName = requestBody.originalName || 'input';
    const safeName = sanitizeFileName(originalName);
    if (!inputKey) return res.status(400).json({ status: 'error', code: 'MISSING_INPUT_KEY', message: 'Missing input key', requestId: req.requestId });
    if (!String(inputKey).startsWith('inputs/')) return res.status(400).json({ status: 'error', code: 'INVALID_INPUT_KEY', message: 'Invalid input key', requestId: req.requestId });
    const inputFormat = (requestBody.inputFormat || path.extname(safeName).replace('.', '') || '').toLowerCase();
    const inputSize = Number(requestBody.inputSize || 0);
    const encryptedSize = Number(requestBody.encryptedSize || 0);
    const checksum = extractChecksumValue(requestBody.checksum || requestBody.inputHash || requestBody.input_hash) || null;
    if (!inputSize || inputSize <= 0) return res.status(400).json({ status: 'error', code: 'INVALID_SIZE', message: 'Invalid file size', requestId: req.requestId });
    if (inputSize > MAX_FILE_SIZE) return res.status(413).json(fileTooLargePayload(req.requestId));
    if (toolMeta?.inputExts?.length && !toolMeta.inputExts.includes(inputFormat)) {
      return res.status(400).json({ status: 'error', code: 'INVALID_FORMAT', message: 'Unsupported input format', requestId: req.requestId });
    }
    if (encryption?.enabled) {
      const metaCheck = validateEncryptionMeta(encryption);
      if (!metaCheck.ok) {
        return res.status(400).json({ status: 'error', code: metaCheck.code, message: metaCheck.message, requestId: req.requestId });
      }
    }
    if (storageMode === 's3') {
      const head = await headObject(inputKey);
      if (!head) return res.status(400).json({ status: 'error', code: 'INPUT_NOT_FOUND', message: 'Input not found', requestId: req.requestId });
      if (encryptedSize && head.size !== encryptedSize) return res.status(400).json({ status: 'error', code: 'SIZE_MISMATCH', message: 'Encrypted size mismatch', requestId: req.requestId });
    }

    const dedupeSignature = buildJobDedupeSignature({
      tool,
      settings,
      checksums: checksum ? [checksum] : [],
      batch: false,
      inputSize
    });
    if (dedupeSignature) {
      const dedupeJobId = await readJobDedupeJobId(scopeKey, dedupeSignature);
      if (dedupeJobId) {
        const existingJob = await queue.getJob(dedupeJobId);
        if (existingJob) {
          const payload = {
            jobId: dedupeJobId,
            tool,
            requested_tool: requestedTool,
            fallback_applied: availability.fallback_applied === true,
            dedupe_reused: true,
            requestId: req.requestId
          };
          if (idempotencyKey) {
            await writeJobIdempotencyResult(scopeKey, idempotencyKey, payload);
          }
          return res.json(payload);
        }
      }
    }

    const base = path.parse(safeName).name || 'output';
    const ext = TOOL_EXT[tool] || (path.parse(safeName).ext.replace('.', '') || 'bin');
    const outputName = `${base}.${ext}`;
    const outputKey = `outputs/${jobId}/${outputName}`;
    const automationApplied = applyAutomationRulesForJob({
      userId: actorUserId,
      tool,
      inputSize,
      settings
    });
    tool = automationApplied.tool;
    settings = automationApplied.settings;

    await withTimeout(queue.add('convert', {
      jobId,
      tool,
      requestedTool,
      fallbackApplied: availability.fallback_applied === true,
      inputKey,
      outputKey,
      originalName: safeName,
      settings,
      inputFormat,
      inputSize,
      checksum,
      requestId: req.requestId,
      userId: actorUserId || null,
      automationApplied: automationApplied.matched_rules,
      encryption
    }, { jobId, timeout }), QUEUE_ADD_TIMEOUT_MS, 'queue_add_timeout');
    log({ type: 'job_created', requestId: req.requestId, jobId, tool, requestedTool, fallbackApplied: availability.fallback_applied === true, batch: false, count: 1, inputSize, inputFormat });

    const payload = {
      jobId,
      tool,
      requested_tool: requestedTool,
      fallback_applied: availability.fallback_applied === true,
      requestId: req.requestId
    };
    if (dedupeSignature) {
      await writeJobDedupeJobId(scopeKey, dedupeSignature, jobId);
    }
    if (idempotencyKey) {
      await writeJobIdempotencyResult(scopeKey, idempotencyKey, payload);
    }
    res.json(payload);
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
      downloadUrl = buildDownloadUrl(req, outputKey);
    }
    if (state === 'failed') {
      error = {
        code: 'CONVERSION_FAILED',
        message: job.failedReason || 'Conversion failed'
      };
    }

    const outputMeta = job.returnvalue && job.returnvalue.outputMeta ? job.returnvalue.outputMeta : null;
    res.json({
      status: state,
      progress,
      itemProgress: progressPayload.itemProgress,
      downloadUrl,
      outputMeta,
      error
    });
  } catch (err) {
    if (isQueueUnavailableError(err)) {
      return res.status(503).json(redisUnavailablePayload(req.requestId, err?.message || 'queue_unavailable'));
    }
    logError({ type: 'job_fetch_failed', requestId: req.requestId, error: err.message || 'unknown' });
    res.status(500).json({ status: 'error', code: 'JOB_FETCH_FAILED', message: 'Failed to fetch job', requestId: req.requestId });
  }
});

app.get('/jobs/:id/events', async (req, res) => {
  const jobId = String(req.params?.id || '').trim();
  if (!jobId) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_JOB_ID',
      message: 'Job id is required',
      requestId: req.requestId
    });
  }

  try {
    const redis = await ensureRedisAvailable(req.requestId);
    if (!redis.ok) {
      return res.status(503).json(redis.payload);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let lastFingerprint = '';
    let closed = false;
    let interval = null;

    const writeEvent = (eventName, payload) => {
      if (closed) return;
      const data = JSON.stringify(asObject(payload));
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    };

    const closeStream = () => {
      if (closed) return;
      closed = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      try {
        res.end();
      } catch {
        // ignore close errors
      }
    };

    const publishSnapshot = async () => {
      if (closed) return;
      const job = await queue.getJob(jobId);
      if (!job) {
        writeEvent('job', {
          status: 'not_found',
          progress: 0,
          jobId,
          requestId: req.requestId
        });
        closeStream();
        return;
      }
      const status = await job.getState();
      const progressPayload = normalizeJobProgressPayload(job.progress);
      const progress = progressPayload.progress;
      const outputKey = (job.returnvalue && job.returnvalue.outputKey) || job.data?.outputKey || null;
      const downloadUrl = status === 'completed' ? buildDownloadUrl(req, outputKey) : null;
      const errorMessage = status === 'failed' ? (job.failedReason || 'Conversion failed') : null;
      const payload = {
        jobId,
        status,
        progress,
        itemProgress: progressPayload.itemProgress,
        downloadUrl,
        download_url: downloadUrl,
        outputMeta: job.returnvalue?.outputMeta || null,
        error: errorMessage ? { code: 'CONVERSION_FAILED', message: errorMessage } : null,
        requestId: req.requestId
      };
      const fingerprint = JSON.stringify({
        status: payload.status,
        progress: payload.progress,
        itemProgress: payload.itemProgress || null,
        downloadUrl: payload.downloadUrl,
        error: payload.error?.message || null
      });
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        writeEvent('job', payload);
      }
      if (status === 'completed' || status === 'failed' || status === 'expired') {
        closeStream();
      }
    };

    req.on('close', closeStream);
    writeEvent('ready', { ok: true, jobId, requestId: req.requestId });
    await publishSnapshot();
    if (!closed) {
      interval = setInterval(() => {
        void publishSnapshot().catch((error) => {
          logError({
            type: 'job_events_publish_failed',
            requestId: req.requestId,
            jobId,
            error: error?.message || 'unknown'
          });
          writeEvent('job', {
            status: 'error',
            progress: 0,
            error: {
              code: 'JOB_EVENTS_FAILED',
              message: 'Failed to stream job events'
            },
            requestId: req.requestId
          });
          closeStream();
        });
      }, JOB_EVENTS_POLL_INTERVAL_MS);
    }
  } catch (error) {
    if (!res.headersSent) {
      if (isQueueUnavailableError(error)) {
        return res.status(503).json(redisUnavailablePayload(req.requestId, error?.message || 'queue_unavailable'));
      }
      return res.status(500).json({
        status: 'error',
        code: 'JOB_EVENTS_FAILED',
        message: 'Failed to stream job events',
        requestId: req.requestId
      });
    }
    return undefined;
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const tooLarge = err?.type === 'entity.too.large'
    || Number(err?.status) === 413
    || Number(err?.statusCode) === 413
    || String(err?.code || '') === 'LIMIT_FILE_SIZE';
  if (tooLarge) {
    return res.status(413).json(fileTooLargePayload(req.requestId));
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Invalid JSON payload',
      requestId: req.requestId
    });
  }
  if (String(err?.message || '') === 'Not allowed by CORS') {
    return res.status(403).json({
      status: 'error',
      code: 'CORS_BLOCKED',
      message: 'Origin is not allowed',
      requestId: req.requestId
    });
  }
  logError({
    type: 'unhandled_http_error',
    requestId: req.requestId || null,
    path: req.path || null,
    error: err?.message || 'unknown'
  });
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    requestId: req.requestId
  });
});

startAnalyticsFlushLoop();
startShareCleanupLoop();
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

let server = null;
if (!SERVERLESS_RUNTIME) {
  const port = process.env.PORT || 3000;
  server = app.listen(port, () => console.log(`API listening on ${port}`));
}

let shuttingDown = false;
const shutdown = async (signal) => {
  if (SERVERLESS_RUNTIME) return;
  if (shuttingDown) return;
  shuttingDown = true;
  log({ type: 'shutdown_start', signal });
  const forceTimer = setTimeout(() => {
    logError({ type: 'shutdown_forced', signal });
    process.exit(1);
  }, 15000);
  if (typeof forceTimer.unref === 'function') forceTimer.unref();
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    if (analyticsFlushTimer) {
      clearInterval(analyticsFlushTimer);
      analyticsFlushTimer = null;
    }
    if (shareCleanupTimer) {
      clearInterval(shareCleanupTimer);
      shareCleanupTimer = null;
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

if (!SERVERLESS_RUNTIME) {
  process.on('SIGINT', () => { shutdown('SIGINT'); });
  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
}

module.exports = app;

