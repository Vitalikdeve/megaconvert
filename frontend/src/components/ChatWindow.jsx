import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

import MessageBubble from './MessageBubble.jsx';

const AUTO_SCROLL_THRESHOLD = 96;

export default function ChatWindow({
  activeChat,
  currentUser,
  headerActions,
  messages,
  onBack,
}) {
  const messageListRef = useRef(null);
  const previousChatIdRef = useRef(activeChat?.id ?? null);
  const previousMessageCountRef = useRef(messages.length);

  useEffect(() => {
    const messageListNode = messageListRef.current;
    if (!messageListNode) {
      return;
    }

    const nextChatId = activeChat?.id ?? null;
    const previousChatId = previousChatIdRef.current;
    const previousMessageCount = previousMessageCountRef.current;
    const isChatChanged = nextChatId !== previousChatId;
    const isNearBottom =
      messageListNode.scrollHeight -
        messageListNode.scrollTop -
        messageListNode.clientHeight <=
      AUTO_SCROLL_THRESHOLD;

    if (isChatChanged || (messages.length > previousMessageCount && isNearBottom)) {
      window.requestAnimationFrame(() => {
        if (!messageListRef.current) {
          return;
        }

        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      });
    }

    previousChatIdRef.current = nextChatId;
    previousMessageCountRef.current = messages.length;
  }, [activeChat?.id, messages]);

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

      <div className="message-list" ref={messageListRef}>
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
      </div>
    </div>
  );
}
