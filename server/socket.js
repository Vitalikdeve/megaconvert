const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const port = Number(process.env.SOCKET_PORT || process.env.PORT || 4000);

const resolveDbConnectionString = () => {
  return String(
    process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL
      || ''
  ).trim();
};

const connectionString = resolveDbConnectionString();
if (!connectionString) {
  console.warn('[socket] DATABASE_URL/POSTGRES_URL is not configured. Message persistence will not work.');
}

const pool = connectionString ? new Pool({ connectionString }) : null;
if (pool) {
  pool.on('error', (error) => {
    console.error('[socket] postgres pool error:', error);
  });
}

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const getUserIdFromSocket = (socket) => {
  const auth = socket.handshake.auth || {};
  const query = socket.handshake.query || {};
  const headerId = socket.handshake.headers && (socket.handshake.headers['x-user-id'] || socket.handshake.headers['x-userid']);

  const candidates = [
    auth.userId,
    auth.user_id,
    query.userId,
    query.user_id,
    Array.isArray(headerId) ? headerId[0] : headerId
  ];

  for (const value of candidates) {
    if (!value) continue;
    const id = String(value).trim();
    if (id) return id;
  }
  return '';
};

const saveMessage = async ({ senderId, receiverId, encryptedContent }) => {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  let payload = encryptedContent;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = { ciphertext: payload, iv: null };
    }
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      INSERT INTO messages (id, sender_id, receiver_id, encrypted_content, is_read)
      VALUES (gen_random_uuid(), $1, $2, $3::jsonb, FALSE)
      RETURNING id, sender_id, receiver_id, encrypted_content, is_read, created_at
      `,
      [senderId, receiverId, payload]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      encryptedContent: row.encrypted_content,
      isRead: row.is_read,
      createdAt: row.created_at
    };
  } finally {
    client.release();
  }
};

io.on('connection', (socket) => {
  const userId = getUserIdFromSocket(socket);

  if (!userId) {
    socket.emit('error', { code: 'UNAUTHENTICATED', message: 'userId is required to connect' });
    socket.disconnect(true);
    return;
  }

  const roomName = `user_${userId}`;
  socket.join(roomName);
  console.log(`[socket] user connected: ${userId}, joined room ${roomName}`);

  socket.on('disconnect', (reason) => {
    console.log(`[socket] user disconnected: ${userId}, reason=${reason}`);
  });

  socket.on('send-private-message', async (payload, callback) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload');
      }

      const receiverId = String(payload.receiverId || payload.contactId || payload.to || '').trim();
      const rawEncrypted = payload.encryptedContent || payload.message || payload.content;
      const encryptedContent = typeof rawEncrypted === 'string' ? rawEncrypted : JSON.stringify(rawEncrypted || '');

      if (!receiverId) {
        throw new Error('receiverId is required');
      }
      if (!encryptedContent || !encryptedContent.trim()) {
        throw new Error('encryptedContent is required');
      }

      const message = await saveMessage({ senderId: userId, receiverId, encryptedContent });

      const targetRoom = `user_${receiverId}`;
      io.to(targetRoom).emit('receive-private-message', message);

      if (typeof callback === 'function') {
        callback({ ok: true, message });
      } else {
        socket.emit('message-sent', { ok: true, message });
      }
    } catch (error) {
      console.error('[socket] send-private-message failed:', error);
      const errorPayload = {
        ok: false,
        code: 'SEND_PRIVATE_MESSAGE_FAILED',
        message: error?.message || 'Failed to send private message'
      };
      if (typeof callback === 'function') {
        callback(errorPayload);
      } else {
        socket.emit('send-private-message-error', errorPayload);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`[socket] server listening on port ${port}`);
});

