import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

import MessageBubble from './MessageBubble.jsx';

export default function ChatWindow({
  activeChat,
  currentUser,
  headerActions,
  messages,
  onBack,
}) {
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

      <div className="message-list">
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

        <div ref={messageEndRef} />
      </div>
    </div>
  );
}
