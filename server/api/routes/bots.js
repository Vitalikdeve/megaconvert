const crypto = require('crypto');
const { Router } = require('express');
const { Pool } = require('pg');

const ADMIN_ROLES = new Set(['admin', 'owner', 'superadmin']);
const BOT_EMAIL_DOMAIN = (process.env.BOT_EMAIL_DOMAIN || 'bots.megaconvert.local').trim() || 'bots.megaconvert.local';
const BOT_TOKEN_ENCRYPTION_SECRET = String(
  process.env.BOT_TOKEN_ENCRYPTION_KEY
    || process.env.JWT_SESSION_SECRET
    || process.env.JWT_SECRET
    || 'dev-bot-token-key-change-me'
).trim();

let warnedAboutDefaultEncryptionSecret = false;

const createPool = () => {
  const connectionString = String(
    process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL
      || ''
  ).trim();

  if (!connectionString) {
    console.warn('[bots] DATABASE_URL/POSTGRES_URL is not configured. Bots routes will fail for DB access.');
    return null;
  }

  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    console.error('[bots] postgres pool error:', error);
  });
  return pool;
};

const pool = createPool();

const getCurrentUserId = (req) => {
  const headerId = req.headers['x-user-id'] || req.headers['x-userid'];
  if (Array.isArray(headerId)) return String(headerId[0] || '').trim();
  return String(headerId || '').trim();
};

const getCurrentUserRoleFromHeader = (req) => {
  const headerRole = req.headers['x-user-role'] || req.headers['x-role'];
  if (Array.isArray(headerRole)) return String(headerRole[0] || '').trim().toLowerCase();
  return String(headerRole || '').trim().toLowerCase();
};

const createId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
};

const createBotToken = () => `mcbot_${crypto.randomBytes(24).toString('hex')}`;

const normalizeBotName = (value) => String(value || '').trim().slice(0, 64);

const normalizeWebhookUrl = (value) => String(value || '').trim();

const validateWebhookUrl = (raw) => {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const createTokenCipherKey = () => {
  if (BOT_TOKEN_ENCRYPTION_SECRET === 'dev-bot-token-key-change-me' && !warnedAboutDefaultEncryptionSecret) {
    warnedAboutDefaultEncryptionSecret = true;
    console.warn('[bots] BOT_TOKEN_ENCRYPTION_KEY is not configured. Development fallback key is used.');
  }
  return crypto.createHash('sha256').update(BOT_TOKEN_ENCRYPTION_SECRET).digest();
};

const encryptBotToken = (token) => {
  const key = createTokenCipherKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(token || ''), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

const ensureBotsSchema = async (client) => {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS bots (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      webhook_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_bots_verified ON bots(is_verified);
  `);
};

const assertAdmin = async (client, req, userId) => {
  const fallbackRole = getCurrentUserRoleFromHeader(req);
  if (ADMIN_ROLES.has(fallbackRole)) {
    return true;
  }

  try {
    const result = await client.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (!result.rows.length) {
      return false;
    }
    const role = String(result.rows[0].role || '').trim().toLowerCase();
    return ADMIN_ROLES.has(role);
  } catch (error) {
    console.error('[bots] admin role check failed:', error);
    return false;
  }
};

function createBotsRouter() {
  const router = Router();

  router.use((req, res, next) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        code: 'DB_NOT_CONFIGURED',
        message: 'База данных не настроена для раздела ботов.'
      });
    }

    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Требуется заголовок x-user-id.'
      });
    }

    req.userId = userId;
    next();
  });

  // POST /api/bots/register
  router.post('/register', async (req, res) => {
    const adminUserId = req.userId;
    const botName = normalizeBotName(req.body?.name || req.body?.botName);
    const requestedWebhookUrl = normalizeWebhookUrl(req.body?.webhookUrl);
    const webhookUrl = requestedWebhookUrl ? validateWebhookUrl(requestedWebhookUrl) : null;

    if (!botName) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Укажите имя бота.'
      });
    }

    if (requestedWebhookUrl && !webhookUrl) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_WEBHOOK_URL',
        message: 'Webhook URL должен быть корректным http/https адресом.'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureBotsSchema(client);

      const isAdmin = await assertAdmin(client, req, adminUserId);
      if (!isAdmin) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Только администратор может регистрировать ботов.'
        });
      }

      const botUserId = createId();
      const botId = createId();
      const botToken = createBotToken();
      const encryptedToken = encryptBotToken(botToken);
      const botEmail = `bot.${botUserId}@${BOT_EMAIL_DOMAIN}`;

      await client.query(
        `
        INSERT INTO users (id, email, name, is_bot, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
        `,
        [botUserId, botEmail, botName]
      );

      const botResult = await client.query(
        `
        INSERT INTO bots (id, user_id, token, is_verified, webhook_url, created_at, updated_at)
        VALUES ($1, $2, $3, FALSE, $4, NOW(), NOW())
        RETURNING id, user_id, is_verified, webhook_url, created_at
        `,
        [botId, botUserId, encryptedToken, webhookUrl]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        ok: true,
        message: `Бот ${botName} подключен`,
        botToken,
        bot: {
          id: botResult.rows[0].id,
          userId: botResult.rows[0].user_id,
          name: botName,
          isVerified: botResult.rows[0].is_verified,
          webhookUrl: botResult.rows[0].webhook_url,
          createdAt: botResult.rows[0].created_at
        }
      });
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // noop
      }
      console.error('[bots] /register failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'BOT_REGISTER_FAILED',
        message: 'Не удалось зарегистрировать бота.'
      });
    } finally {
      client.release();
    }
  });

  // POST /api/bots/webhook/setup
  router.post('/webhook/setup', async (req, res) => {
    const adminUserId = req.userId;
    const botId = String(req.body?.botId || '').trim();
    const requestedWebhookUrl = normalizeWebhookUrl(req.body?.webhookUrl);
    const webhookUrl = validateWebhookUrl(requestedWebhookUrl);

    if (!botId) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Укажите botId.'
      });
    }

    if (!webhookUrl) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_WEBHOOK_URL',
        message: 'Webhook URL должен быть корректным http/https адресом.'
      });
    }

    const client = await pool.connect();
    try {
      await ensureBotsSchema(client);
      const isAdmin = await assertAdmin(client, req, adminUserId);
      if (!isAdmin) {
        return res.status(403).json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Только администратор может изменять webhook бота.'
        });
      }

      const updateResult = await client.query(
        `
        UPDATE bots
        SET webhook_url = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, user_id, webhook_url, is_verified, updated_at
        `,
        [webhookUrl, botId]
      );

      if (!updateResult.rows.length) {
        return res.status(404).json({
          ok: false,
          code: 'BOT_NOT_FOUND',
          message: 'Бот не найден.'
        });
      }

      const botRow = updateResult.rows[0];
      const userResult = await client.query(
        'SELECT name FROM users WHERE id = $1 LIMIT 1',
        [botRow.user_id]
      );
      const botName = String(userResult.rows[0]?.name || 'бот').trim();

      return res.json({
        ok: true,
        message: `Webhook для бота ${botName} сохранен`,
        bot: {
          id: botRow.id,
          userId: botRow.user_id,
          name: botName,
          webhookUrl: botRow.webhook_url,
          isVerified: botRow.is_verified,
          updatedAt: botRow.updated_at
        }
      });
    } catch (error) {
      console.error('[bots] /webhook/setup failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'BOT_WEBHOOK_SETUP_FAILED',
        message: 'Не удалось сохранить webhook бота.'
      });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = {
  createBotsRouter
};
