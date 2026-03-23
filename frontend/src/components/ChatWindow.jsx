import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import MessageBubble from './MessageBubble.jsx';

const AUTO_SCROLL_THRESHOLD = 96;
const MotionButton = motion.button;

const isUserNearBottom = (container) =>
  container.scrollTop + container.clientHeight >=
  container.scrollHeight - AUTO_SCROLL_THRESHOLD;

export default function ChatWindow({
  activeChat,
  currentUser,
  headerActions,
  messages,
  onBack,
  typingParticipant,
}) {
  const messageListRef = useRef(null);
  const previousChatIdRef = useRef(activeChat?.id ?? null);
  const previousMessageCountRef = useRef(messages.length);
  const [hasUnreadBelowFold, setHasUnreadBelowFold] = useState(false);

  const getMessageContainer = useCallback(
    () =>
      messageListRef.current ??
      (typeof document !== 'undefined'
        ? document.querySelector('.chat-messages')
        : null),
    []
  );

  const scrollToBottom = useCallback(() => {
    const container = getMessageContainer();

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    setHasUnreadBelowFold(false);
  }, [getMessageContainer]);

  const handleMessageListScroll = useCallback(() => {
    const container = getMessageContainer();

    if (!container) {
      return;
    }

    if (isUserNearBottom(container)) {
      setHasUnreadBelowFold(false);
    }
  }, [getMessageContainer]);

  useEffect(() => {
    const messageListNode = getMessageContainer();
    if (!messageListNode) {
      return;
    }

    const nextChatId = activeChat?.id ?? null;
    const previousChatId = previousChatIdRef.current;
    const previousMessageCount = previousMessageCountRef.current;
    const isChatChanged = nextChatId !== previousChatId;
    const isNearBottom = isUserNearBottom(messageListNode);

    if (isChatChanged) {
      window.requestAnimationFrame(() => {
        scrollToBottom();
      });
    } else if (messages.length > previousMessageCount) {
      if (isNearBottom) {
        window.requestAnimationFrame(() => {
          scrollToBottom();
        });
      } else {
        window.requestAnimationFrame(() => {
          setHasUnreadBelowFold(true);
        });
      }
    }

    previousChatIdRef.current = nextChatId;
    previousMessageCountRef.current = messages.length;
  }, [activeChat?.id, getMessageContainer, messages, scrollToBottom]);

  useEffect(() => {
    if (!typingParticipant) {
      return;
    }

    const container = getMessageContainer();
    if (!container || !isUserNearBottom(container)) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [getMessageContainer, scrollToBottom, typingParticipant]);

  if (!activeChat) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          Choose a conversation on the left to start messaging.
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <header className="chat-window__header">
        <div className="chat-window__headline">
          <button
            className="icon-button mobile-back"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="avatar">{activeChat.displayName.slice(0, 1).toUpperCase()}</div>

          <div>
            <h2>{activeChat.displayName}</h2>
            <p>
              {activeChat.isSavedMessages
                ? 'Only visible to you'
                : activeChat.presenceLabel ?? 'Realtime conversation'}
            </p>
          </div>
        </div>

        <div className="chat-window__actions">
          {headerActions}

          <span className="status-pill status-pill--connected">
            <ShieldCheck size={14} />
            {activeChat.isSavedMessages ? 'Encrypted notes' : 'Realtime channel'}
          </span>
        </div>
      </header>

      <div className="chat-window__body">
        <div
          className="message-list chat-messages"
          onScroll={handleMessageListScroll}
          ref={messageListRef}
        >
          {messages.length === 0 ? (
            <div className="empty-state">
              Send the first message to {activeChat.isSavedMessages ? 'yourself' : activeChat.displayName}.
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageBubble
              isOwn={String(message.senderId) === String(currentUser.userId)}
              key={`${message.id}-${message.createdAt}`}
              message={message}
            />
          ))}

          {typingParticipant && !activeChat.isSavedMessages ? (
            <div className="typing-indicator" role="status">
              {typingParticipant.senderName} is typing...
            </div>
          ) : null}
        </div>

        <AnimatePresence>
          {hasUnreadBelowFold ? (
            <MotionButton
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="new-messages-btn"
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              onClick={scrollToBottom}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              type="button"
            >
              ↓ New messages
            </MotionButton>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
