const { Pool } = require('pg');

const createPool = () => {
  const connectionString = String(
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || ''
  ).trim();

  if (!connectionString) {
    console.warn('[messenger] DATABASE_URL/POSTGRES_URL is not configured. Messenger routes will fail for DB access.');
    return null;
  }

  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    console.error('[messenger] postgres pool error:', error);
  });
  return pool;
};

const pool = createPool();

const getCurrentUserId = (req) => {
  const headerId = req.user?.id || req.headers['x-user-id'] || req.headers['x-userid'];
  if (Array.isArray(headerId)) return String(headerId[0] || '').trim();
  return String(headerId || '').trim();
};

const parseLimit = (value, fallback = 50, max = 200) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

const parseOffset = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

async function requirePool(res) {
  if (!pool) {
    res.status(500).json({ ok: false, code: 'DB_NOT_CONFIGURED', message: 'Database connection is not configured for messenger' });
    return false;
  }
  return true;
}

async function registerPublicKey(req, res) {
  if (!await requirePool(res)) return;
  try {
    const userId = getCurrentUserId(req);
    const { publicKey } = req.body || {};

    if (!userId) {
      return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED', message: 'x-user-id header is required' });
    }
    if (!publicKey) {
      return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', message: 'publicKey is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('UPDATE users SET public_key = $1, updated_at = NOW() WHERE id = $2', [publicKey, userId]);
      return res.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[messenger] registerPublicKey failed:', error);
    return res.status(500).json({ ok: false, code: 'PUBLIC_KEY_SAVE_FAILED', message: 'Failed to save messenger public key' });
  }
}

async function getContactPublicKey(req, res) {
  if (!await requirePool(res)) return;
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED', message: 'x-user-id header is required' });
    }

    const contactId = String(req.params.contactId || '').trim();
    if (!contactId) {
      return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', message: 'contactId is required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT public_key FROM users WHERE id = $1', [contactId]);
      if (!result.rows.length || !result.rows[0].public_key) {
        return res.status(404).json({ ok: false, code: 'PUBLIC_KEY_NOT_FOUND', message: 'Contact public key not found' });
      }
      return res.json({ ok: true, publicKey: result.rows[0].public_key });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[messenger] getContactPublicKey failed:', error);
    return res.status(500).json({ ok: false, code: 'PUBLIC_KEY_FETCH_FAILED', message: 'Failed to load contact public key' });
  }
}

async function loadHistory(req, res) {
  if (!await requirePool(res)) return;
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED', message: 'x-user-id header is required' });
    }

    const contactId = String(req.params.contactId || '').trim();
    if (!contactId) {
      return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', message: 'contactId is required' });
    }

    const limit = parseLimit(req.query.limit, 50, 200);
    const offset = parseOffset(req.query.offset);

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT id, sender_id, receiver_id, encrypted_content, is_read, created_at
        FROM messages
        WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        `,
        [userId, contactId, limit, offset]
      );

      return res.json({
        ok: true,
        items: result.rows,
        pagination: { limit, offset, count: result.rows.length }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[messenger] loadHistory failed:', error);
    return res.status(500).json({ ok: false, code: 'MESSAGE_LIST_FAILED', message: 'Failed to load messages' });
  }
}

module.exports = {
  registerPublicKey,
  getContactPublicKey,
  loadHistory,
  getCurrentUserId,
  pool,
};
