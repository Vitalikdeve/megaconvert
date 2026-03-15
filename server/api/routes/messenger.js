const { Router } = require('express');
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
  const headerId = req.headers['x-user-id'] || req.headers['x-userid'];
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

function createMessengerRouter() {
  const router = Router();

  router.use((req, res, next) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        code: 'DB_NOT_CONFIGURED',
        message: 'Database connection is not configured for messenger'
      });
    }
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'x-user-id header is required'
      });
    }
    req.userId = userId;
    next();
  });

  // POST /api/contacts/add
  router.post('/contacts/add', async (req, res) => {
    try {
      const { email } = req.body || {};
      const userId = req.userId;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'email is required'
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const client = await pool.connect();
      try {
        const userResult = await client.query(
          'SELECT id, email, name FROM users WHERE LOWER(email) = $1',
          [normalizedEmail]
        );

        if (!userResult.rows.length) {
          return res.status(404).json({
            ok: false,
            code: 'USER_NOT_FOUND',
            message: 'User with this email was not found'
          });
        }

        const contact = userResult.rows[0];
        const contactId = contact.id;

        if (contactId === userId) {
          return res.status(400).json({
            ok: false,
            code: 'CANNOT_ADD_SELF',
            message: 'You cannot add yourself as a contact'
          });
        }

        const existingResult = await client.query(
          `
          SELECT id, status
          FROM user_contacts
          WHERE (user_id = $1 AND contact_id = $2)
             OR (user_id = $2 AND contact_id = $1)
          `,
          [userId, contactId]
        );

        if (existingResult.rows.length) {
          const existing = existingResult.rows[0];
          return res.json({
            ok: true,
            contactRequest: {
              id: existing.id,
              userId,
              contactId,
              status: existing.status
            }
          });
        }

        const insertResult = await client.query(
          `
          INSERT INTO user_contacts (id, user_id, contact_id, status)
          VALUES (gen_random_uuid(), $1, $2, 'pending')
          RETURNING id, user_id, contact_id, status, created_at
          `,
          [userId, contactId]
        );

        return res.status(201).json({
          ok: true,
          contactRequest: {
            id: insertResult.rows[0].id,
            userId,
            contactId,
            status: insertResult.rows[0].status,
            createdAt: insertResult.rows[0].created_at,
            contact: {
              id: contact.id,
              email: contact.email,
              name: contact.name
            }
          }
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[messenger] /contacts/add failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'CONTACT_ADD_FAILED',
        message: 'Failed to add contact request'
      });
    }
  });

  // GET /api/contacts
  router.get('/contacts', async (req, res) => {
    try {
      const userId = req.userId;
      const client = await pool.connect();
      try {
        const result = await client.query(
          `
          SELECT
            uc.id,
            uc.contact_id,
            uc.status,
            uc.created_at,
            u.email,
            u.name
          FROM user_contacts uc
          JOIN users u ON u.id = uc.contact_id
          WHERE uc.user_id = $1
          ORDER BY uc.created_at DESC
          `,
          [userId]
        );

        const items = result.rows.map((row) => ({
          id: row.id,
          contactId: row.contact_id,
          status: row.status,
          createdAt: row.created_at,
          contact: {
            id: row.contact_id,
            email: row.email,
            name: row.name
          }
        }));

        return res.json({
          ok: true,
          items
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[messenger] /contacts failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'CONTACT_LIST_FAILED',
        message: 'Failed to load contacts'
      });
    }
  });

  // GET /api/messages/:contactId
  router.get('/messages/:contactId', async (req, res) => {
    try {
      const userId = req.userId;
      const contactId = String(req.params.contactId || '').trim();
      if (!contactId) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'contactId is required'
        });
      }

      const limit = parseLimit(req.query.limit, 50, 200);
      const offset = parseOffset(req.query.offset);

      const client = await pool.connect();
      try {
        const result = await client.query(
          `
          SELECT
            id,
            sender_id,
            receiver_id,
            encrypted_content,
            is_read,
            created_at
          FROM messages
          WHERE (sender_id = $1 AND receiver_id = $2)
             OR (sender_id = $2 AND receiver_id = $1)
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
          `,
          [userId, contactId, limit, offset]
        );

        const items = result.rows.map((row) => ({
          id: row.id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          encryptedContent: row.encrypted_content,
          isRead: row.is_read,
          createdAt: row.created_at
        }));

        return res.json({
          ok: true,
          items,
          pagination: {
            limit,
            offset,
            count: items.length
          }
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[messenger] /messages/:contactId failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'MESSAGE_LIST_FAILED',
        message: 'Failed to load messages'
      });
    }
  });

  // POST /api/messages
  router.post('/messages', async (req, res) => {
    try {
      const userId = req.userId;
      const { receiverId: bodyReceiverId, contactId, encryptedContent: bodyEncrypted, message } = req.body || {};
      const receiverId = String(bodyReceiverId || contactId || '').trim();

      let encryptedContent = bodyEncrypted || message;

      if (!receiverId) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'receiverId is required'
        });
      }
      if (typeof encryptedContent === 'object') {
        encryptedContent = JSON.stringify(encryptedContent);
      }

      if (!encryptedContent || typeof encryptedContent !== 'string') {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'encryptedContent is required'
        });
      }

      const client = await pool.connect();
      try {
        const insertResult = await client.query(
          `
          INSERT INTO messages (id, sender_id, receiver_id, encrypted_content, is_read)
          VALUES (gen_random_uuid(), $1, $2, $3::jsonb, FALSE)
          RETURNING id, sender_id, receiver_id, encrypted_content, is_read, created_at
          `,
          [userId, receiverId, encryptedContent]
        );

        const row = insertResult.rows[0];
        return res.status(201).json({
          ok: true,
          message: {
            id: row.id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            encryptedContent: row.encrypted_content,
            isRead: row.is_read,
            createdAt: row.created_at
          }
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[messenger] /messages failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'MESSAGE_CREATE_FAILED',
        message: 'Failed to create message'
      });
    }
  });

  return router;
}

module.exports = {
  createMessengerRouter
};

