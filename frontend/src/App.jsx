import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import ChatPage from './app/chat/index.jsx';
import LoginPage from './app/login/index.jsx';
import MeetPage from './app/meet/index.jsx';
import RegisterPage from './app/register/index.jsx';
import {
  fetchChatMessages,
  fetchUsers,
  loginUser,
  registerUser,
  sendChatMessage,
} from './services/api.js';
import { socket } from './services/socket.js';

const MotionDiv = motion.div;

const SESSION_STORAGE_KEY = 'messenger.session';
const MESSAGE_STORAGE_KEY = 'messenger.messages';
const USER_CACHE_STORAGE_KEY = 'messenger.users';
const TYPING_INDICATOR_TIMEOUT = 2000;
const TYPING_EMIT_THROTTLE = 1200;

const pageTransition = {
  initial: { opacity: 0, y: 18, filter: 'blur(18px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -14,
    filter: 'blur(18px)',
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
};

const readStorage = (key, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures for private browsing modes.
  }
};

const chatIdForUser = (userId) => `dm:${String(userId)}`;

const buildSavedMessagesChat = (session) => ({
  id: `saved:${String(session.userId || session.username)}`,
  userId: String(session.userId || session.username),
  username: session.username,
  displayName: 'Saved Messages',
  subtitle: 'Private notes, links, and voice drafts',
  status: 'secure',
  isSavedMessages: true,
});

const normalizeAuthSession = (payload, fallbackUsername) => {
  const data = payload?.data ?? payload?.user ?? payload ?? {};
  const nestedUser = data.user ?? {};
  const username = String(
    nestedUser.username ??
      data.username ??
      nestedUser.handle ??
      data.handle ??
      fallbackUsername
  ).trim();

  return {
    token:
      data.token ??
      data.accessToken ??
      data.jwt ??
      nestedUser.token ??
      null,
    liveKitToken:
      data.liveKitToken ??
      data.livekitToken ??
      data.participantToken ??
      nestedUser.liveKitToken ??
      nestedUser.livekitToken ??
      nestedUser.participantToken ??
      null,
    userId: String(
      nestedUser.id ??
        nestedUser.userId ??
        data.id ??
        data.userId ??
        username
    ),
    username: username || fallbackUsername,
  };
};

const normalizeUsersPayload = (payload, session) => {
  const source =
    payload?.data ??
    payload?.users ??
    payload?.items ??
    payload ??
    [];

  if (!Array.isArray(source)) {
    return [];
  }

  const seen = new Set();

  return source
    .map((entry, index) => {
      const rawId =
        entry?.id ??
        entry?.userId ??
        entry?.uuid ??
        entry?.username ??
        entry?.handle ??
        `user-${index}`;
      const username = String(
        entry?.username ??
          entry?.handle ??
          entry?.name ??
          `user-${index}`
      ).trim();
      const userId = String(rawId);

      if (!username) {
        return null;
      }

      if (
        userId === String(session.userId) ||
        username.toLowerCase() === session.username.toLowerCase()
      ) {
        return null;
      }

      if (seen.has(userId)) {
        return null;
      }

      seen.add(userId);

      return {
        id: userId,
        username,
        displayName: String(entry?.displayName ?? entry?.name ?? username),
        subtitle: String(
          entry?.bio ??
            entry?.headline ??
            entry?.statusMessage ??
            'Start a secure conversation'
        ),
        status: String(entry?.status ?? entry?.presence ?? 'offline'),
        avatar: entry?.avatarUrl ?? entry?.avatar ?? null,
      };
    })
    .filter(Boolean);
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
          name: String(attachment.name ?? attachment.fileName ?? `Attachment ${index + 1}`),
          size: Number(attachment.size ?? attachment.sizeBytes ?? 0),
          type: String(attachment.type ?? attachment.mimeType ?? 'application/octet-stream'),
        }))
    : [];

const formatRelativeStatus = (status) => {
  if (status === 'online' || status === 'active') {
    return 'online now';
  }

  if (status === 'away') {
    return 'away';
  }

  return 'last seen recently';
};

const normalizeIncomingMessage = (payload, session) => {
  const senderId = String(
    payload?.senderId ??
      payload?.fromUserId ??
      payload?.userId ??
      payload?.username ??
      payload?.sender ??
      'unknown'
  );
  const senderName = String(
    payload?.username ??
      payload?.senderName ??
      payload?.sender ??
      payload?.from ??
      senderId
  );
  const explicitChatId =
    payload?.chatId ??
    payload?.conversationId ??
    payload?.roomId ??
    (payload?.toUserId && senderId === String(session.userId)
      ? chatIdForUser(payload.toUserId)
      : null);

  const chatId = String(
    explicitChatId ??
      (senderId === String(session.userId)
        ? `saved:${String(session.userId || session.username)}`
        : chatIdForUser(senderId))
  );

  return {
    id: String(
      payload?.id ??
        payload?.clientMessageId ??
        `${chatId}-${payload?.createdAt ?? Date.now()}`
    ),
    clientMessageId: payload?.clientMessageId ?? payload?.id ?? null,
    chatId,
    text: String(payload?.text ?? payload?.message ?? payload?.body ?? '').trim(),
    senderId,
    senderName,
    createdAt: payload?.createdAt ?? new Date().toISOString(),
    attachments: normalizeAttachments(payload?.attachments),
  };
};

const mergeMessage = (currentMessages, nextMessage) => {
  const alreadyExists = currentMessages.some(
    (message) =>
      message.id === nextMessage.id ||
      (message.clientMessageId &&
        nextMessage.clientMessageId &&
        message.clientMessageId === nextMessage.clientMessageId)
  );

  if (alreadyExists) {
    return currentMessages.map((message) => {
      if (
        message.id === nextMessage.id ||
        (message.clientMessageId &&
          nextMessage.clientMessageId &&
          message.clientMessageId === nextMessage.clientMessageId)
      ) {
        return {
          ...message,
          ...nextMessage,
        };
      }

      return message;
    });
  }

  return [...currentMessages, nextMessage].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
};

const normalizeStoredMessage = (payload, { activeChat, session }) => {
  const senderId = String(
    payload?.senderId ??
      payload?.sender_id ??
      payload?.fromUserId ??
      payload?.userId ??
      session.userId
  );
  const senderName =
    senderId === String(session.userId)
      ? session.username
      : String(payload?.senderName ?? activeChat?.displayName ?? senderId);

  return {
    id: String(payload?.id ?? `${activeChat?.id ?? 'chat'}-${payload?.createdAt ?? Date.now()}`),
    clientMessageId:
      payload?.clientMessageId ??
      payload?.client_message_id ??
      payload?.encryptedContent?.clientMessageId ??
      null,
    chatId: String(payload?.chatId ?? activeChat?.id ?? ''),
    text: String(
      payload?.text ??
        payload?.message ??
        payload?.body ??
        payload?.ciphertext ??
        payload?.encryptedContent?.ciphertext ??
        ''
    ).trim(),
    senderId,
    senderName,
    createdAt: payload?.createdAt ?? new Date().toISOString(),
    attachments: normalizeAttachments(
      payload?.attachments ?? payload?.encryptedContent?.attachments
    ),
  };
};

const normalizeStoredMessagesPayload = (payload, context) => {
  const source =
    payload?.messages ??
    payload?.items ??
    payload?.data ??
    payload ??
    [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry) => normalizeStoredMessage(entry, context))
    .filter((message) => message.text || message.attachments.length > 0);
};

const ensureChatFromMessage = (chats, message) => {
  if (chats.some((chat) => chat.id === message.chatId)) {
    return chats;
  }

  return [
    ...chats,
    {
      id: message.chatId,
      userId: message.senderId,
      username: message.senderName,
      displayName: message.senderName,
      subtitle: 'Conversation discovered from live traffic',
      status: 'online',
      avatar: null,
      isSavedMessages: false,
    },
  ];
};

const createOptimisticMessage = ({ activeChat, currentUser, text, attachments }) => ({
  id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  clientMessageId: `client-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  chatId: activeChat.id,
  text: text.trim(),
  senderId: String(currentUser.userId || currentUser.username),
  senderName: currentUser.username,
  createdAt: new Date().toISOString(),
  attachments: attachments.map((file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  })),
});

const getPageTitle = (pathname) => {
  if (pathname.startsWith('/chat')) {
    return 'Mega Messenger | Chat';
  }

  if (pathname.startsWith('/meet')) {
    return 'Mega Messenger | Meeting';
  }

  if (pathname.startsWith('/register')) {
    return 'Mega Messenger | Register';
  }

  return 'Mega Messenger | Login';
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef(new Map());
  const typingEmitRef = useRef(new Map());
  const [session, setSession] = useState(() => readStorage(SESSION_STORAGE_KEY, null));
  const [messagesByChat, setMessagesByChat] = useState(() =>
    readStorage(MESSAGE_STORAGE_KEY, {})
  );
  const [users, setUsers] = useState(() => readStorage(USER_CACHE_STORAGE_KEY, []));
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [connectionState, setConnectionState] = useState('offline');
  const [activeChatId, setActiveChatId] = useState(null);
  const [typingByChat, setTypingByChat] = useState({});
  const [inactiveMessageCount, setInactiveMessageCount] = useState(0);

  const basePageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.title =
      inactiveMessageCount > 0
        ? `(${inactiveMessageCount}) New ${inactiveMessageCount === 1 ? 'message' : 'messages'}`
        : basePageTitle;
  }, [basePageTitle, inactiveMessageCount]);

  const clearTypingIndicator = useCallback((chatId) => {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
      return;
    }

    const timeoutId = typingTimeoutsRef.current.get(normalizedChatId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      typingTimeoutsRef.current.delete(normalizedChatId);
    }

    setTypingByChat((currentState) => {
      if (!currentState[normalizedChatId]) {
        return currentState;
      }

      const nextState = { ...currentState };
      delete nextState[normalizedChatId];
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setInactiveMessageCount(0);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(
    () => () => {
      typingTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      typingTimeoutsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    writeStorage(SESSION_STORAGE_KEY, session);
  }, [session]);

  useEffect(() => {
    writeStorage(MESSAGE_STORAGE_KEY, messagesByChat);
  }, [messagesByChat]);

  useEffect(() => {
    writeStorage(USER_CACHE_STORAGE_KEY, users);
  }, [users]);

  const chats = useMemo(() => {
    if (!session) {
      return [];
    }

    const savedMessages = buildSavedMessagesChat(session);
    const baseChats = [
      savedMessages,
      ...users.map((user) => ({
        ...user,
        id: chatIdForUser(user.id),
        userId: user.id,
        subtitle: user.subtitle,
        presenceLabel: formatRelativeStatus(user.status),
      })),
    ];

    const withLiveTraffic = Object.values(messagesByChat).flat().reduce(
      (accumulator, message) => ensureChatFromMessage(accumulator, message),
      baseChats
    );

    return withLiveTraffic
      .map((chat) => {
        const chatMessages = messagesByChat[chat.id] ?? [];

        return {
          ...chat,
          lastMessage: chatMessages.at(-1),
        };
      })
      .sort((left, right) => {
        const leftTimestamp = left.lastMessage
          ? new Date(left.lastMessage.createdAt).getTime()
          : 0;
        const rightTimestamp = right.lastMessage
          ? new Date(right.lastMessage.createdAt).getTime()
          : 0;

        return rightTimestamp - leftTimestamp;
      });
  }, [messagesByChat, session, users]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0] ?? null,
    [activeChatId, chats]
  );

  const activeMessages = useMemo(
    () => (activeChat ? messagesByChat[activeChat.id] ?? [] : []),
    [activeChat, messagesByChat]
  );
  const activeTypingParticipant = activeChat ? typingByChat[activeChat.id] ?? null : null;
  const activeChatDisplayName = activeChat?.displayName ?? '';
  const activeChatKey = activeChat?.id ?? '';
  const sessionToken = session?.token ?? '';
  const sessionUserId = session?.userId ?? '';
  const sessionUsername = session?.username ?? '';

  const emitTypingEvent = useCallback(
    (chat) => {
      if (
        !chat ||
        !socketRef.current?.connected ||
        chat.isSavedMessages ||
        !chat.userId
      ) {
        return;
      }

      const chatId = String(chat.id || '').trim();
      if (!chatId) {
        return;
      }

      const now = Date.now();
      const lastEmittedAt = typingEmitRef.current.get(chatId) ?? 0;
      if (now - lastEmittedAt < TYPING_EMIT_THROTTLE) {
        return;
      }

      typingEmitRef.current.set(chatId, now);
      socketRef.current.emit('typing', {
        chatId,
        senderName: session?.username,
        toUserId: String(chat.userId),
        username: session?.username,
      });
    },
    [session?.username]
  );

  useEffect(() => {
    if (!session) {
      setActiveChatId(null);
      return;
    }

    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
      return;
    }

    if (activeChatId && !chats.some((chat) => chat.id === activeChatId) && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats, session]);

  useEffect(() => {
    if (!session) {
      setUsers([]);
      setUsersError('');
      setTypingByChat({});
      typingEmitRef.current.clear();
      typingTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      typingTimeoutsRef.current.clear();
      return;
    }

    let isMounted = true;

    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError('');

      try {
        const payload = await fetchUsers(session.token);

        if (!isMounted) {
          return;
        }

        setUsers(normalizeUsersPayload(payload, session));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsersError(
          error instanceof Error
            ? error.message
            : 'Unable to load users right now.'
        );
        setUsers([]);
      } finally {
        if (isMounted) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!sessionToken || !activeChatKey || !sessionUserId || !sessionUsername) {
      return undefined;
    }

    let isMounted = true;

    const loadMessages = async () => {
      try {
        const payload = await fetchChatMessages(activeChatKey, sessionToken);
        if (!isMounted) {
          return;
        }

        const persistedMessages = normalizeStoredMessagesPayload(payload, {
          activeChat: {
            displayName: activeChatDisplayName,
            id: activeChatKey,
          },
          session: {
            token: sessionToken,
            userId: sessionUserId,
            username: sessionUsername,
          },
        });

        setMessagesByChat((currentState) => ({
          ...currentState,
          [activeChatKey]: persistedMessages,
        }));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load persisted messages', error);
        }
      }
    };

    void loadMessages();

    return () => {
      isMounted = false;
    };
  }, [
    activeChatDisplayName,
    activeChatKey,
    sessionToken,
    sessionUserId,
    sessionUsername,
  ]);

  useEffect(() => {
    if (!session) {
      socket.auth = {};
      socket.disconnect();
      socketRef.current = null;
      setConnectionState('offline');
      return undefined;
    }

    socketRef.current = socket;
    socket.auth = {
      userId: String(session.userId),
      username: session.username,
    };
    socket.connect();

    const handleConnect = () => {
      setConnectionState('connected');
    };

    const handleDisconnect = () => {
      setConnectionState('offline');
    };

    const handleConnectError = () => {
      setConnectionState('degraded');
    };

    const handleReceiveMessage = (payload) => {
      const normalized = normalizeIncomingMessage(payload, session);

      setMessagesByChat((currentState) => ({
        ...currentState,
        [normalized.chatId]: mergeMessage(
          currentState[normalized.chatId] ?? [],
          normalized
        ),
      }));

      clearTypingIndicator(normalized.chatId);

      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible' &&
        normalized.senderId !== String(session.userId)
      ) {
        setInactiveMessageCount((currentCount) => currentCount + 1);
      }
    };

    const handleUserTyping = (payload) => {
      const senderId = String(payload?.senderId ?? '');
      const chatId = String(
        payload?.chatId ?? (senderId ? chatIdForUser(senderId) : '')
      ).trim();

      if (!chatId || !senderId || senderId === String(session.userId)) {
        return;
      }

      const senderName =
        String(payload?.senderName ?? payload?.username ?? 'Someone').trim() ||
        'Someone';

      const existingTimeoutId = typingTimeoutsRef.current.get(chatId);
      if (existingTimeoutId) {
        window.clearTimeout(existingTimeoutId);
      }

      setTypingByChat((currentState) => ({
        ...currentState,
        [chatId]: {
          senderId,
          senderName,
        },
      }));

      const timeoutId = window.setTimeout(() => {
        clearTypingIndicator(chatId);
      }, TYPING_INDICATOR_TIMEOUT);

      typingTimeoutsRef.current.set(chatId, timeoutId);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.disconnect();
      socket.auth = {};
      socketRef.current = null;
    };
  }, [clearTypingIndicator, session]);

  const handleLogin = async (credentials) => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await loginUser(credentials);
      const nextSession = normalizeAuthSession(payload, credentials.username);
      setSession(nextSession);
      navigate('/chat');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to sign in right now.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (credentials) => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await registerUser(credentials);
      const nextSession = normalizeAuthSession(payload, credentials.username);
      setSession(nextSession);
      navigate('/chat');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to create the account.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    typingTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    typingTimeoutsRef.current.clear();
    typingEmitRef.current.clear();
    setSession(null);
    setMessagesByChat({});
    setUsers([]);
    setUsersError('');
    setConnectionState('offline');
    setTypingByChat({});
    setInactiveMessageCount(0);
    navigate('/login');
  };

  const handleCreateChat = (user) => {
    const nextChatId = chatIdForUser(user.id);

    setUsers((currentUsers) => {
      const exists = currentUsers.some((entry) => entry.id === user.id);
      return exists ? currentUsers : [...currentUsers, user];
    });
    setActiveChatId(nextChatId);
  };

  const handleSendMessage = async ({ text, attachments }) => {
    if (!session || !activeChat || (!text.trim() && attachments.length === 0)) {
      return;
    }

    const optimisticMessage = createOptimisticMessage({
      activeChat,
      currentUser: session,
      text,
      attachments,
    });

    setMessagesByChat((currentState) => ({
      ...currentState,
      [activeChat.id]: mergeMessage(
        currentState[activeChat.id] ?? [],
        optimisticMessage
      ),
    }));

    try {
      const payload = await sendChatMessage(
        {
          attachments: optimisticMessage.attachments,
          chatId: activeChat.id,
          clientMessageId: optimisticMessage.clientMessageId,
          text: optimisticMessage.text,
        },
        session.token
      );

      const persistedMessage = normalizeStoredMessage(payload?.message ?? payload, {
        activeChat,
        session,
      });

      setMessagesByChat((currentState) => ({
        ...currentState,
        [activeChat.id]: mergeMessage(
          currentState[activeChat.id] ?? [],
          persistedMessage
        ),
      }));

      if (!activeChat.isSavedMessages && activeChat.userId) {
        socketRef.current?.emit('send_message', {
          attachments: persistedMessage.attachments,
          chatId: persistedMessage.chatId,
          clientMessageId: persistedMessage.clientMessageId,
          createdAt: persistedMessage.createdAt,
          id: persistedMessage.id,
          senderId: session.userId,
          senderName: persistedMessage.senderName,
          text: persistedMessage.text,
          toUserId: activeChat.userId,
          username: session.username,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to persist message', error);
      }
    }
  };

  return (
    <div className="app-root">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={<Navigate to={session ? '/chat' : '/login'} replace />}
          />
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to="/chat" replace />
              ) : (
                <MotionDiv {...pageTransition}>
                  <LoginPage
                    error={authError}
                    isSubmitting={authBusy}
                    onSubmit={handleLogin}
                  />
                </MotionDiv>
              )
            }
          />
          <Route
            path="/register"
            element={
              session ? (
                <Navigate to="/chat" replace />
              ) : (
                <MotionDiv {...pageTransition}>
                  <RegisterPage
                    error={authError}
                    isSubmitting={authBusy}
                    onSubmit={handleRegister}
                  />
                </MotionDiv>
              )
            }
          />
          <Route
            path="/chat"
            element={
              session ? (
                <MotionDiv {...pageTransition}>
                  <ChatPage
                    activeChat={activeChat}
                    chats={chats}
                    connectionState={connectionState}
                    currentUser={session}
                    messages={activeMessages}
                    onCreateChat={handleCreateChat}
                    onLogout={handleLogout}
                    onSelectChat={setActiveChatId}
                    onSendMessage={handleSendMessage}
                    onTyping={emitTypingEvent}
                    typingParticipant={activeTypingParticipant}
                    users={users}
                    usersError={usersError}
                    usersLoading={usersLoading}
                  />
                </MotionDiv>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/meet/:roomId"
            element={
              session ? (
                <MotionDiv {...pageTransition}>
                  <MeetPage currentUser={session} />
                </MotionDiv>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="*"
            element={<Navigate to={session ? '/chat' : '/login'} replace />}
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
