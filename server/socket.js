const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const port = Number(process.env.SOCKET_PORT || process.env.PORT || 4000);
const CHANNEL_ADMIN_ROLES = new Set(['owner', 'admin']);
const SYSTEM_MESSAGES_RU = {
  channelCreated: (adminName, channelName) => `${adminName} создал канал ${channelName}`,
  botConnected: (botName) => `Бот ${botName} подключен`
};

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

const toSocketError = (error, fallbackCode, fallbackMessage) => ({
  ok: false,
  code: String(error?.code || fallbackCode || 'UNKNOWN_ERROR'),
  message: String(error?.message || fallbackMessage || 'Внутренняя ошибка')
});

const normalizeMessageAttachments = (attachments) =>
  Array.isArray(attachments)
    ? attachments.filter(Boolean).map((attachment, index) => ({
        id: String(attachment.id || attachment.name || `attachment-${index}`),
        name: String(attachment.name || attachment.fileName || `Attachment ${index + 1}`),
        size: Number(attachment.size || 0),
        type: String(attachment.type || attachment.mimeType || 'application/octet-stream')
      }))
    : [];

const resolveTargetUserId = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidates = [
    payload.toUserId,
    payload.receiverId,
    payload.contactId,
    payload.targetUserId,
    payload.to
  ];

  for (const value of candidates) {
    if (!value) continue;
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const relayRealtimeMessage = ({ payload, socket, userId, username, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const targetUserId = resolveTargetUserId(payload);
    const text = String(payload.text || payload.message || '').trim();
    const attachments = normalizeMessageAttachments(payload.attachments);
    if (!text && attachments.length === 0) {
      const error = new Error('Текст сообщения или вложения обязательны');
      error.code = 'MESSAGE_REQUIRED';
      throw error;
    }

    const baseMessage = {
      attachments,
      chatId: String(payload.chatId || '').trim(),
      clientMessageId: payload.clientMessageId || null,
      createdAt: payload.createdAt || new Date().toISOString(),
      id: String(
        payload.id || `message_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
      ),
      senderId: String(payload.senderId || userId),
      senderName: String(payload.senderName || payload.username || username || 'guest').trim() || 'guest',
      text
    };

    if (targetUserId && targetUserId !== userId) {
      io.to(`user_${targetUserId}`).emit('receive_message', {
        ...baseMessage,
        chatId: baseMessage.chatId.startsWith('saved:')
          ? `dm:${userId}`
          : `dm:${userId}`,
        toUserId: targetUserId
      });
    }

    socket.to(`user_${userId}`).emit('receive_message', {
      ...baseMessage,
      toUserId: targetUserId || userId
    });

    if (typeof callback === 'function') {
      callback({
        ok: true,
        message: {
          ...baseMessage,
          toUserId: targetUserId || userId
        }
      });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'REALTIME_MESSAGE_FAILED',
      'Не удалось переслать сообщение'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit('send_message-error', errorPayload);
    }
  }
};

const relayTypingIndicator = ({ payload, socket, userId, username, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const targetUserId = resolveTargetUserId(payload);
    if (!targetUserId || targetUserId === userId) {
      if (typeof callback === 'function') {
        callback({ ok: true });
      }
      return;
    }

    io.to(`user_${targetUserId}`).emit('user_typing', {
      chatId: String(payload.chatId || `dm:${userId}`).trim() || `dm:${userId}`,
      senderId: userId,
      senderName: String(payload.senderName || payload.username || username || 'guest').trim() || 'guest',
      toUserId: targetUserId
    });

    if (typeof callback === 'function') {
      callback({ ok: true });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'TYPING_RELAY_FAILED',
      'Не удалось передать индикатор набора'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit('typing-error', errorPayload);
    }
  }
};

const getUsernameFromSocket = (socket) => {
  const auth = socket.handshake.auth || {};
  const query = socket.handshake.query || {};

  const candidates = [
    auth.username,
    auth.handle,
    query.username,
    query.handle
  ];

  for (const value of candidates) {
    if (!value) continue;
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return 'guest';
};

const relayPeerEvent = ({ eventName, payload, socket, userId, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const targetUserId = resolveTargetUserId(payload);
    if (!targetUserId) {
      const error = new Error('toUserId обязателен');
      error.code = 'TARGET_USER_REQUIRED';
      throw error;
    }

    if (targetUserId === userId) {
      const error = new Error('Нельзя отправить сигнал самому себе');
      error.code = 'SELF_SIGNAL_NOT_ALLOWED';
      throw error;
    }

    const forwardedPayload = {
      ...payload,
      fromUserId: userId
    };

    io.to(`user_${targetUserId}`).emit(eventName, forwardedPayload);

    if (typeof callback === 'function') {
      callback({
        ok: true,
        event: eventName,
        toUserId: targetUserId
      });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'PEER_SIGNAL_FAILED',
      'Не удалось отправить WebRTC сигнал'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit(`${eventName}-error`, errorPayload);
    }
  }
};

const meetingRooms = new Map();

const normalizeMeetingRoomId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const getMeetingRoomKey = (roomId) => `meet_${roomId}`;

const getMeetingRoomParticipants = (roomId) =>
  Array.from(meetingRooms.get(roomId)?.values() ?? []);

const addMeetingParticipant = ({ roomId, participant }) => {
  if (!meetingRooms.has(roomId)) {
    meetingRooms.set(roomId, new Map());
  }

  meetingRooms.get(roomId).set(participant.peerId, participant);
};

const removeMeetingParticipant = ({ roomId, peerId }) => {
  const room = meetingRooms.get(roomId);
  if (!room) {
    return;
  }

  room.delete(peerId);
  if (room.size === 0) {
    meetingRooms.delete(roomId);
  }
};

const relayMeetingSignal = ({ eventName, payload, socket, userId, username, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const roomId = normalizeMeetingRoomId(payload.roomId);
    const toPeerId = String(payload.toPeerId || '').trim();
    if (!roomId) {
      const error = new Error('roomId обязателен');
      error.code = 'ROOM_ID_REQUIRED';
      throw error;
    }

    if (!toPeerId) {
      const error = new Error('toPeerId обязателен');
      error.code = 'TARGET_PEER_REQUIRED';
      throw error;
    }

    io.to(toPeerId).emit(eventName, {
      ...payload,
      roomId,
      fromPeerId: socket.id,
      fromUserId: userId,
      fromUsername: username
    });

    if (typeof callback === 'function') {
      callback({ ok: true, roomId, toPeerId, event: eventName });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'MEETING_SIGNAL_FAILED',
      'Не удалось отправить сигнал участнику встречи'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit(`${eventName}-error`, errorPayload);
    }
  }
};

const relayMeetingMessage = ({ payload, socket, userId, username, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const roomId = normalizeMeetingRoomId(payload.roomId);
    const message = String(payload.message || payload.text || '').trim();
    if (!roomId) {
      const error = new Error('roomId обязателен');
      error.code = 'ROOM_ID_REQUIRED';
      throw error;
    }

    if (!message) {
      const error = new Error('message обязателен');
      error.code = 'MESSAGE_REQUIRED';
      throw error;
    }

    const activeMeetingRoomId = normalizeMeetingRoomId(socket.data?.meetingRoomId);
    if (!activeMeetingRoomId || activeMeetingRoomId !== roomId) {
      const error = new Error('Сначала войдите в комнату встречи');
      error.code = 'MEETING_ROOM_REQUIRED';
      throw error;
    }

    const outgoingMessage = {
      id: `meeting_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      roomId,
      message,
      sender: {
        userId,
        username: username || String(payload.sender || 'guest').trim() || 'guest'
      },
      createdAt: new Date().toISOString()
    };

    io.to(getMeetingRoomKey(roomId)).emit('meeting-message', outgoingMessage);

    if (typeof callback === 'function') {
      callback({
        ok: true,
        roomId,
        message: outgoingMessage
      });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'MEETING_MESSAGE_FAILED',
      'Не удалось отправить сообщение встречи'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit('meeting-message-error', errorPayload);
    }
  }
};

const relayMeetingReaction = ({ payload, socket, userId, username, callback }) => {
  try {
    if (!payload || typeof payload !== 'object') {
      const error = new Error('Некорректный payload');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const roomId = normalizeMeetingRoomId(payload.roomId);
    const emoji = String(payload.emoji || '').trim();
    if (!roomId) {
      const error = new Error('roomId обязателен');
      error.code = 'ROOM_ID_REQUIRED';
      throw error;
    }

    if (!emoji) {
      const error = new Error('emoji обязателен');
      error.code = 'EMOJI_REQUIRED';
      throw error;
    }

    const activeMeetingRoomId = normalizeMeetingRoomId(socket.data?.meetingRoomId);
    if (!activeMeetingRoomId || activeMeetingRoomId !== roomId) {
      const error = new Error('Сначала войдите в комнату встречи');
      error.code = 'MEETING_ROOM_REQUIRED';
      throw error;
    }

    const outgoingReaction = {
      id: `reaction_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      roomId,
      emoji,
      sender: {
        userId,
        username: username || String(payload.sender || 'guest').trim() || 'guest'
      },
      createdAt: new Date().toISOString()
    };

    io.to(getMeetingRoomKey(roomId)).emit('reaction', outgoingReaction);

    if (typeof callback === 'function') {
      callback({
        ok: true,
        roomId,
        reaction: outgoingReaction
      });
    }
  } catch (error) {
    const errorPayload = toSocketError(
      error,
      'MEETING_REACTION_FAILED',
      'Не удалось отправить реакцию встречи'
    );

    if (typeof callback === 'function') {
      callback(errorPayload);
    } else {
      socket.emit('reaction-error', errorPayload);
    }
  }
};

const normalizeEncryptedPayload = (rawValue) => {
  if (!rawValue) {
    return { ciphertext: '', iv: null };
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // keep raw ciphertext format
    }
    return { ciphertext: rawValue, iv: null };
  }

  if (typeof rawValue === 'object') {
    return rawValue;
  }

  return { ciphertext: String(rawValue), iv: null };
};

const ensureSocketSchema = async () => {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY,
        title TEXT,
        type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE IF EXISTS chats
        ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

      CREATE TABLE IF NOT EXISTS chat_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (chat_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS channel_metadata (
        chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
        description TEXT,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        subscriber_count BIGINT NOT NULL DEFAULT 0 CHECK (subscriber_count >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE IF EXISTS messages
        ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;

      ALTER TABLE IF EXISTS messages
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS bots (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        webhook_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = 'receiver_id'
            AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;
        END IF;
      END $$;
    `);
  } finally {
    client.release();
  }
};

const schemaReady = ensureSocketSchema()
  .catch((error) => {
    console.error('[socket] schema bootstrap failed:', error);
  });

const saveDirectMessage = async ({ senderId, receiverId, encryptedContent }) => {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  const payload = normalizeEncryptedPayload(encryptedContent);
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

const resolveChatAccess = async ({ chatId, userId }) => {
  if (!pool) {
    const error = new Error('База данных недоступна');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        c.id,
        c.type,
        COALESCE(c.title, 'Канал') AS title,
        cm.role
      FROM chats c
      LEFT JOIN chat_members cm
        ON cm.chat_id = c.id
       AND cm.user_id = $2
      WHERE c.id = $1
      LIMIT 1
      `,
      [chatId, userId]
    );

    if (!result.rows.length) {
      const error = new Error('Чат не найден');
      error.code = 'CHAT_NOT_FOUND';
      throw error;
    }

    const row = result.rows[0];
    if (!row.role) {
      const error = new Error('Пользователь не состоит в чате');
      error.code = 'CHAT_MEMBERSHIP_REQUIRED';
      throw error;
    }

    return {
      chatId: row.id,
      type: String(row.type || 'direct').trim().toLowerCase(),
      title: row.title,
      role: String(row.role || 'member').trim().toLowerCase()
    };
  } finally {
    client.release();
  }
};

const saveChatMessage = async ({ senderId, chatId, encryptedContent, isChannelDelivery }) => {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  const payload = normalizeEncryptedPayload(encryptedContent);
  const metadata = {
    delivery: isChannelDelivery ? 'channel' : 'chat',
    maskedSender: Boolean(isChannelDelivery)
  };

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      INSERT INTO messages (id, sender_id, receiver_id, chat_id, encrypted_content, metadata, is_read)
      VALUES (gen_random_uuid(), $1, NULL, $2, $3::jsonb, $4::jsonb, FALSE)
      RETURNING id, sender_id, chat_id, encrypted_content, metadata, is_read, created_at
      `,
      [senderId, chatId, payload, metadata]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      senderId: row.sender_id,
      chatId: row.chat_id,
      encryptedContent: row.encrypted_content,
      metadata: row.metadata,
      isRead: row.is_read,
      createdAt: row.created_at
    };
  } finally {
    client.release();
  }
};

const processChatMessage = async ({ payload, userId }) => {
  const chatId = String(payload?.chatId || payload?.channelId || '').trim();
  const rawEncrypted = payload?.encryptedContent || payload?.message || payload?.content;
  if (!chatId) {
    const error = new Error('chatId обязателен');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const normalizedPayload = normalizeEncryptedPayload(rawEncrypted);
  const ciphertext = String(normalizedPayload?.ciphertext || '').trim();
  if (!ciphertext) {
    const error = new Error('encryptedContent обязателен');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const access = await resolveChatAccess({ chatId, userId });
  if (access.type === 'channel' && !CHANNEL_ADMIN_ROLES.has(access.role)) {
    const error = new Error('Только администратор канала может отправлять сообщения');
    error.code = 'CHANNEL_ADMIN_REQUIRED';
    throw error;
  }

  const message = await saveChatMessage({
    senderId: userId,
    chatId: access.chatId,
    encryptedContent: normalizedPayload,
    isChannelDelivery: access.type === 'channel'
  });

  const outgoingMessage = {
    id: message.id,
    chatId: message.chatId,
    encryptedContent: message.encryptedContent,
    isRead: message.isRead,
    createdAt: message.createdAt,
    senderId: access.type === 'channel' ? null : message.senderId,
    senderType: access.type === 'channel' ? 'channel' : 'user',
    channelTitle: access.type === 'channel' ? access.title : null
  };

  io.to(`chat_${chatId}`).emit('receive-chat-message', outgoingMessage);
  return outgoingMessage;
};

io.on('connection', (socket) => {
  const userId = getUserIdFromSocket(socket);
  const username = getUsernameFromSocket(socket);

  if (!userId) {
    socket.emit('error', { code: 'UNAUTHENTICATED', message: 'userId is required to connect' });
    socket.disconnect(true);
    return;
  }

  const roomName = `user_${userId}`;
  socket.join(roomName);
  console.log(`[socket] user connected: ${userId}, joined room ${roomName}`);

  socket.on('disconnect', (reason) => {
    const activeMeetingRoomId = normalizeMeetingRoomId(socket.data?.meetingRoomId);
    if (activeMeetingRoomId) {
      removeMeetingParticipant({ roomId: activeMeetingRoomId, peerId: socket.id });
      io.to(getMeetingRoomKey(activeMeetingRoomId)).emit('room-user-left', {
        roomId: activeMeetingRoomId,
        peerId: socket.id,
        userId
      });
    }
    console.log(`[socket] user disconnected: ${userId}, reason=${reason}`);
  });

  socket.on('join-room', (payload, callback) => {
    try {
      const roomId = normalizeMeetingRoomId(payload?.roomId ?? payload);
      if (!roomId) {
        const error = new Error('roomId обязателен');
        error.code = 'ROOM_ID_REQUIRED';
        throw error;
      }

      const previousRoomId = normalizeMeetingRoomId(socket.data?.meetingRoomId);
      if (previousRoomId && previousRoomId !== roomId) {
        removeMeetingParticipant({ roomId: previousRoomId, peerId: socket.id });
        socket.leave(getMeetingRoomKey(previousRoomId));
        io.to(getMeetingRoomKey(previousRoomId)).emit('room-user-left', {
          roomId: previousRoomId,
          peerId: socket.id,
          userId
        });
      }

      const existingParticipants = getMeetingRoomParticipants(roomId).filter(
        (participant) => participant.peerId !== socket.id
      );
      const participant = {
        peerId: socket.id,
        userId,
        username
      };

      socket.join(getMeetingRoomKey(roomId));
      socket.data.meetingRoomId = roomId;
      addMeetingParticipant({ roomId, participant });

      socket.to(getMeetingRoomKey(roomId)).emit('room-user-joined', {
        roomId,
        participant
      });

      if (typeof callback === 'function') {
        callback({
          ok: true,
          roomId,
          selfPeerId: socket.id,
          participants: existingParticipants
        });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback(toSocketError(error, 'JOIN_ROOM_FAILED', 'Не удалось войти во встречу'));
      } else {
        socket.emit('join-room-error', toSocketError(error, 'JOIN_ROOM_FAILED', 'Не удалось войти во встречу'));
      }
    }
  });

  socket.on('leave-room', (payload, callback) => {
    const roomId = normalizeMeetingRoomId(payload?.roomId ?? payload);
    if (!roomId) {
      const errorPayload = {
        ok: false,
        code: 'ROOM_ID_REQUIRED',
        message: 'roomId обязателен'
      };
      if (typeof callback === 'function') {
        callback(errorPayload);
      } else {
        socket.emit('leave-room-error', errorPayload);
      }
      return;
    }

    removeMeetingParticipant({ roomId, peerId: socket.id });
    socket.leave(getMeetingRoomKey(roomId));
    if (socket.data?.meetingRoomId === roomId) {
      delete socket.data.meetingRoomId;
    }

    io.to(getMeetingRoomKey(roomId)).emit('room-user-left', {
      roomId,
      peerId: socket.id,
      userId
    });

    if (typeof callback === 'function') {
      callback({ ok: true, roomId });
    }
  });

  socket.on('room-offer', (payload, callback) => {
    relayMeetingSignal({
      eventName: 'room-offer',
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('room-answer', (payload, callback) => {
    relayMeetingSignal({
      eventName: 'room-answer',
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('room-ice-candidate', (payload, callback) => {
    relayMeetingSignal({
      eventName: 'room-ice-candidate',
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('meeting-message', (payload, callback) => {
    relayMeetingMessage({
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('reaction', (payload, callback) => {
    relayMeetingReaction({
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('send_message', (payload, callback) => {
    relayRealtimeMessage({
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('typing', (payload, callback) => {
    relayTypingIndicator({
      payload,
      socket,
      userId,
      username,
      callback
    });
  });

  socket.on('call-user', (payload, callback) => {
    relayPeerEvent({ eventName: 'call-user', payload, socket, userId, callback });
  });

  socket.on('call-accepted', (payload, callback) => {
    relayPeerEvent({ eventName: 'call-accepted', payload, socket, userId, callback });
  });

  socket.on('call-declined', (payload, callback) => {
    relayPeerEvent({ eventName: 'call-declined', payload, socket, userId, callback });
  });

  socket.on('call-offer', (payload, callback) => {
    relayPeerEvent({ eventName: 'call-offer', payload, socket, userId, callback });
  });

  socket.on('call-answer', (payload, callback) => {
    relayPeerEvent({ eventName: 'call-answer', payload, socket, userId, callback });
  });

  socket.on('ice-candidate', (payload, callback) => {
    relayPeerEvent({ eventName: 'ice-candidate', payload, socket, userId, callback });
  });

  socket.on('end-call', (payload, callback) => {
    relayPeerEvent({ eventName: 'end-call', payload, socket, userId, callback });
  });

  socket.on('join-chat-room', async (payload, callback) => {
    try {
      await schemaReady;
      const chatId = String(payload?.chatId || payload?.channelId || '').trim();
      if (!chatId) {
        const error = new Error('chatId обязателен');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const access = await resolveChatAccess({ chatId, userId });
      const chatRoom = `chat_${chatId}`;
      socket.join(chatRoom);

      if (typeof callback === 'function') {
        callback({
          ok: true,
          room: chatRoom,
          chat: {
            id: access.chatId,
            type: access.type,
            role: access.role
          }
        });
      }
    } catch (error) {
      console.error('[socket] join-chat-room failed:', error);
      if (typeof callback === 'function') {
        callback(toSocketError(error, 'JOIN_CHAT_ROOM_FAILED', 'Не удалось войти в комнату чата'));
      } else {
        socket.emit('join-chat-room-error', toSocketError(error, 'JOIN_CHAT_ROOM_FAILED', 'Не удалось войти в комнату чата'));
      }
    }
  });

  socket.on('leave-chat-room', (payload, callback) => {
    const chatId = String(payload?.chatId || payload?.channelId || '').trim();
    if (!chatId) {
      const errorPayload = {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'chatId обязателен'
      };
      if (typeof callback === 'function') {
        callback(errorPayload);
      } else {
        socket.emit('leave-chat-room-error', errorPayload);
      }
      return;
    }

    const chatRoom = `chat_${chatId}`;
    socket.leave(chatRoom);
    if (typeof callback === 'function') {
      callback({ ok: true, room: chatRoom });
    }
  });

  socket.on('send-private-message', async (payload, callback) => {
    try {
      await schemaReady;
      if (!payload || typeof payload !== 'object') {
        const error = new Error('Некорректный payload');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const chatId = String(payload.chatId || payload.channelId || '').trim();
      if (chatId) {
        const outgoingMessage = await processChatMessage({ payload, userId });
        if (typeof callback === 'function') {
          callback({ ok: true, message: outgoingMessage });
        } else {
          socket.emit('chat-message-sent', { ok: true, message: outgoingMessage });
        }
        return;
      }

      const receiverId = String(payload.receiverId || payload.contactId || payload.to || '').trim();
      const rawEncrypted = payload.encryptedContent || payload.message || payload.content;

      if (!receiverId) {
        const error = new Error('receiverId обязателен');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const normalizedPayload = normalizeEncryptedPayload(rawEncrypted);
      const ciphertext = String(normalizedPayload?.ciphertext || '').trim();
      if (!ciphertext) {
        const error = new Error('encryptedContent обязателен');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const message = await saveDirectMessage({ senderId: userId, receiverId, encryptedContent: normalizedPayload });
      const targetRoom = `user_${receiverId}`;
      io.to(targetRoom).emit('receive-private-message', message);

      if (typeof callback === 'function') {
        callback({ ok: true, message });
      } else {
        socket.emit('message-sent', { ok: true, message });
      }
    } catch (error) {
      console.error('[socket] send-private-message failed:', error);
      const errorPayload = toSocketError(error, 'SEND_PRIVATE_MESSAGE_FAILED', 'Не удалось отправить личное сообщение');
      if (typeof callback === 'function') {
        callback(errorPayload);
      } else {
        socket.emit('send-private-message-error', errorPayload);
      }
    }
  });

  socket.on('send-chat-message', async (payload, callback) => {
    try {
      await schemaReady;
      if (!payload || typeof payload !== 'object') {
        const error = new Error('Некорректный payload');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const outgoingMessage = await processChatMessage({ payload, userId });

      if (typeof callback === 'function') {
        callback({ ok: true, message: outgoingMessage });
      } else {
        socket.emit('chat-message-sent', { ok: true, message: outgoingMessage });
      }
    } catch (error) {
      console.error('[socket] send-chat-message failed:', error);
      const errorPayload = toSocketError(error, 'SEND_CHAT_MESSAGE_FAILED', 'Не удалось отправить сообщение в чат');
      if (typeof callback === 'function') {
        callback(errorPayload);
      } else {
        socket.emit('send-chat-message-error', errorPayload);
      }
    }
  });

  socket.on('send-channel-system-message', async (payload, callback) => {
    try {
      await schemaReady;
      const chatId = String(payload?.chatId || payload?.channelId || '').trim();
      if (!chatId) {
        const error = new Error('chatId обязателен');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const access = await resolveChatAccess({ chatId, userId });
      if (access.type !== 'channel') {
        const error = new Error('Системные сообщения поддерживаются только для каналов');
        error.code = 'CHANNEL_REQUIRED';
        throw error;
      }
      if (!CHANNEL_ADMIN_ROLES.has(access.role)) {
        const error = new Error('Только администратор канала может отправлять системные сообщения');
        error.code = 'CHANNEL_ADMIN_REQUIRED';
        throw error;
      }

      const systemType = String(payload?.systemType || '').trim().toLowerCase();
      const adminName = String(payload?.adminName || 'Админ').trim() || 'Админ';
      const channelName = String(payload?.channelName || access.title || 'Канал').trim() || 'Канал';
      const botName = String(payload?.botName || 'бот').trim() || 'бот';

      let text = '';
      if (systemType === 'channel_created') {
        text = SYSTEM_MESSAGES_RU.channelCreated(adminName, channelName);
      } else if (systemType === 'bot_connected') {
        text = SYSTEM_MESSAGES_RU.botConnected(botName);
      } else {
        const error = new Error('Неизвестный тип системного сообщения');
        error.code = 'SYSTEM_MESSAGE_TYPE_UNSUPPORTED';
        throw error;
      }

      const systemMessage = {
        id: `system_${Date.now()}`,
        chatId,
        type: 'system',
        text,
        senderId: null,
        senderType: 'channel',
        createdAt: new Date().toISOString()
      };

      io.to(`chat_${chatId}`).emit('receive-chat-message', systemMessage);

      if (typeof callback === 'function') {
        callback({ ok: true, message: systemMessage });
      }
    } catch (error) {
      console.error('[socket] send-channel-system-message failed:', error);
      if (typeof callback === 'function') {
        callback(toSocketError(error, 'SEND_CHANNEL_SYSTEM_MESSAGE_FAILED', 'Не удалось отправить системное сообщение'));
      } else {
        socket.emit('send-channel-system-message-error', toSocketError(error, 'SEND_CHANNEL_SYSTEM_MESSAGE_FAILED', 'Не удалось отправить системное сообщение'));
      }
    }
  });
});

server.listen(port, () => {
  console.log(`[socket] server listening on port ${port}`);
});

