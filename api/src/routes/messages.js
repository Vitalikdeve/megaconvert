const crypto = require('crypto');
const { Router } = require('express');

const MESSAGE_PAGE_SIZE = 200;

const createId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString('hex');
};

const normalizeEncryptedPayload = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return { ciphertext: value };
    }
  }

  return {};
};

const normalizeAttachments = (attachments) =>
  Array.isArray(attachments)
    ? attachments
        .filter(Boolean)
        .map((attachment, index) => ({
          id: String(
            attachment.id ??
              attachment.name ??
              attachment.fileName ??
              `attachment-${index}`
          ),
          name: String(
            attachment.name ?? attachment.fileName ?? `Attachment ${index + 1}`
          ),
          size: Number(attachment.size ?? attachment.sizeBytes ?? 0),
          type: String(
            attachment.type ?? attachment.mimeType ?? 'application/octet-stream'
          ),
        }))
    : [];

const parseChatId = ({ chatId, currentUserId }) => {
  const normalizedChatId = String(chatId || '').trim();
  if (!normalizedChatId) {
    const error = new Error('chatId is required');
    error.code = 'CHAT_ID_REQUIRED';
    throw error;
  }

  if (normalizedChatId.startsWith('saved:')) {
    const ownerId = String(normalizedChatId.slice('saved:'.length) || '').trim();
    if (!ownerId) {
      const error = new Error('Invalid saved messages chat id');
      error.code = 'INVALID_CHAT_ID';
      throw error;
    }

    if (ownerId !== currentUserId) {
      const error = new Error('You can only access your own saved messages');
      error.code = 'CHAT_ACCESS_DENIED';
      throw error;
    }

    return {
      chatId: normalizedChatId,
      kind: 'saved',
      receiverId: currentUserId,
    };
  }

  if (normalizedChatId.startsWith('dm:')) {
    const peerId = String(normalizedChatId.slice('dm:'.length) || '').trim();
    if (!peerId) {
      const error = new Error('Invalid direct message chat id');
      error.code = 'INVALID_CHAT_ID';
      throw error;
    }

    return {
      chatId: normalizedChatId,
      kind: 'direct',
      receiverId: peerId,
    };
  }

  const error = new Error('Unsupported chatId format');
  error.code = 'CHAT_ID_UNSUPPORTED';
  throw error;
};

const mapMessageRow = ({ chatId, currentUserId, row }) => {
  const payload = normalizeEncryptedPayload(row?.encrypted_content);

  return {
    id: String(row?.id || createId()),
    chatId,
    senderId: String(row?.sender_id || currentUserId),
    text: String(payload?.ciphertext ?? payload?.text ?? '').trim(),
    attachments: normalizeAttachments(payload?.attachments),
    clientMessageId:
      payload?.clientMessageId ?? payload?.client_message_id ?? null,
    createdAt: row?.created_at ?? new Date().toISOString(),
  };
};

const createMessagesRouter = ({ getPgPool, requireUserAuth }) => {
  const router = Router();

  router.use((req, res, next) =>
    typeof requireUserAuth === 'function'
      ? requireUserAuth(req, res, next)
      : next()
  );

  router.get('/messages', async (req, res) => {
    const pool = typeof getPgPool === 'function' ? getPgPool() : null;
    if (!pool) {
      return res.status(503).json({
        status: 'error',
        code: 'DATABASE_UNAVAILABLE',
        message: 'Message storage is unavailable right now',
        requestId: req.requestId,
      });
    }

    try {
      const currentUserId = String(req.user?.id || '').trim();
      const chatContext = parseChatId({
        chatId: req.query?.chatId,
        currentUserId,
      });

      const limit = Math.max(
        1,
        Math.min(
          MESSAGE_PAGE_SIZE,
          Number(req.query?.limit || MESSAGE_PAGE_SIZE)
        )
      );

      const result =
        chatContext.kind === 'saved'
          ? await pool.query(
              `
                SELECT id, sender_id, receiver_id, encrypted_content, created_at
                FROM (
                  SELECT id, sender_id, receiver_id, encrypted_content, created_at
                  FROM messages
                  WHERE sender_id = $1
                    AND receiver_id = $1
                  ORDER BY created_at DESC
                  LIMIT $2
                ) AS recent_messages
                ORDER BY created_at ASC
              `,
              [currentUserId, limit]
            )
          : await pool.query(
              `
                SELECT id, sender_id, receiver_id, encrypted_content, created_at
                FROM (
                  SELECT id, sender_id, receiver_id, encrypted_content, created_at
                  FROM messages
                  WHERE (
                    sender_id = $1
                    AND receiver_id = $2
                  ) OR (
                    sender_id = $2
                    AND receiver_id = $1
                  )
                  ORDER BY created_at DESC
                  LIMIT $3
                ) AS recent_messages
                ORDER BY created_at ASC
              `,
              [currentUserId, chatContext.receiverId, limit]
            );

      return res.json({
        ok: true,
        messages: result.rows.map((row) =>
          mapMessageRow({
            chatId: chatContext.chatId,
            currentUserId,
            row,
          })
        ),
      });
    } catch (error) {
      const statusCode = error?.code === 'CHAT_ACCESS_DENIED' ? 403 : 400;
      const isKnownValidationError = [
        'CHAT_ACCESS_DENIED',
        'CHAT_ID_REQUIRED',
        'CHAT_ID_UNSUPPORTED',
        'INVALID_CHAT_ID',
      ].includes(String(error?.code || ''));

      if (isKnownValidationError) {
        return res.status(statusCode).json({
          status: 'error',
          code: error.code,
          message: error.message,
          requestId: req.requestId,
        });
      }

      return res.status(500).json({
        status: 'error',
        code: 'MESSAGES_FETCH_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load messages',
        requestId: req.requestId,
      });
    }
  });

  router.post('/messages', async (req, res) => {
    const pool = typeof getPgPool === 'function' ? getPgPool() : null;
    if (!pool) {
      return res.status(503).json({
        status: 'error',
        code: 'DATABASE_UNAVAILABLE',
        message: 'Message storage is unavailable right now',
        requestId: req.requestId,
      });
    }

    try {
      const currentUserId = String(req.user?.id || '').trim();
      const chatContext = parseChatId({
        chatId: req.body?.chatId,
        currentUserId,
      });
      const text = String(req.body?.text || '').trim();
      const attachments = normalizeAttachments(req.body?.attachments);

      if (!text && attachments.length === 0) {
        return res.status(400).json({
          status: 'error',
          code: 'MESSAGE_EMPTY',
          message: 'text or attachments are required',
          requestId: req.requestId,
        });
      }

      const encryptedContent = {
        attachments,
        ciphertext: text,
        clientMessageId: String(req.body?.clientMessageId || '').trim() || null,
      };

      const result = await pool.query(
        `
          INSERT INTO messages (
            id,
            sender_id,
            receiver_id,
            encrypted_content,
            is_read
          )
          VALUES ($1, $2, $3, $4::jsonb, FALSE)
          RETURNING id, sender_id, receiver_id, encrypted_content, created_at
        `,
        [
          createId(),
          currentUserId,
          chatContext.receiverId,
          JSON.stringify(encryptedContent),
        ]
      );

      return res.status(201).json({
        ok: true,
        message: mapMessageRow({
          chatId: chatContext.chatId,
          currentUserId,
          row: result.rows[0],
        }),
      });
    } catch (error) {
      const statusCode = error?.code === 'CHAT_ACCESS_DENIED' ? 403 : 400;
      const isKnownValidationError = [
        'CHAT_ACCESS_DENIED',
        'CHAT_ID_REQUIRED',
        'CHAT_ID_UNSUPPORTED',
        'INVALID_CHAT_ID',
      ].includes(String(error?.code || ''));

      if (isKnownValidationError) {
        return res.status(statusCode).json({
          status: 'error',
          code: error.code,
          message: error.message,
          requestId: req.requestId,
        });
      }

      return res.status(500).json({
        status: 'error',
        code: 'MESSAGE_CREATE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to store the message',
        requestId: req.requestId,
      });
    }
  });

  return router;
};

module.exports = {
  createMessagesRouter,
};
