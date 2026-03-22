import { LogOut, MessageCirclePlus, Search, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

const connectionClassMap = {
  connected: 'status-pill status-pill--connected',
  degraded: 'status-pill status-pill--degraded',
  offline: 'status-pill status-pill--offline',
};

const formatLastMessage = (chat) => {
  if (!chat.lastMessage) {
    return chat.subtitle;
  }

  if (chat.lastMessage.attachments.length > 0 && !chat.lastMessage.text) {
    return 'Shared an attachment';
  }

  return chat.lastMessage.text || 'Started a secure chat';
};

const formatLastTime = (chat) => {
  if (!chat.lastMessage?.createdAt) {
    return 'now';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(chat.lastMessage.createdAt));
};

export default function ChatSidebar({
  chats,
  connectionState,
  currentUser,
  isComposerOpen,
  onCreateChat,
  onLogout,
  onSearchChange,
  onSelectChat,
  onToggleComposer,
  searchValue,
  selectedChatId,
  users,
  usersError,
  usersLoading,
}) {
  const filteredChats = chats.filter((chat) => {
    if (!searchValue.trim()) {
      return true;
    }

    const query = searchValue.trim().toLowerCase();

    return (
      chat.displayName.toLowerCase().includes(query) ||
      chat.username.toLowerCase().includes(query)
    );
  });

  const filteredUsers = users.filter((user) => {
    if (!searchValue.trim()) {
      return true;
    }

    const query = searchValue.trim().toLowerCase();

    return (
      user.displayName.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query)
    );
  });

  return (
    <aside className="glass-panel sidebar-panel">
      <div className="sidebar-header">
        <div className="avatar">{currentUser.username.slice(0, 1).toUpperCase()}</div>

        <div>
          <h1 className="sidebar-title">Mega Messenger</h1>
          <p className="sidebar-subtitle">@{currentUser.username}</p>
        </div>

        <div className="sidebar-tools">
          <span className={connectionClassMap[connectionState] ?? connectionClassMap.offline}>
            {connectionState === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connectionState === 'connected'
              ? 'Live'
              : connectionState === 'degraded'
                ? 'Trying to reconnect'
                : 'Offline'}
          </span>
        </div>
      </div>

      <div className="search-shell">
        <Search size={16} />
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chats or users"
          value={searchValue}
        />
      </div>

      <div className="sidebar-tools" style={{ marginBottom: '1rem', marginLeft: 0 }}>
        <button
          className="glass-button glass-button--ghost"
          onClick={onToggleComposer}
          type="button"
        >
          <MessageCirclePlus size={16} />
          Create chat
        </button>
        <button className="icon-button" onClick={onLogout} type="button">
          <LogOut size={17} />
        </button>
      </div>

      {isComposerOpen ? (
        <MotionDiv
          animate={{ opacity: 1, y: 0 }}
          className="composer-sheet"
          initial={{ opacity: 0, y: -8 }}
        >
          <div className="composer-sheet__header">
            <div>
              <h3>Start a new chat</h3>
              <p>Pick a user from the existing backend directory.</p>
            </div>
          </div>

          {usersLoading ? (
            <div className="empty-state">Loading users from the backend...</div>
          ) : usersError ? (
            <div className="empty-state">{usersError}</div>
          ) : (
            <div className="composer-people">
              {filteredUsers.map((user) => (
                <button
                  className="person-row"
                  key={user.id}
                  onClick={() => onCreateChat(user)}
                  type="button"
                >
                  <div className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
                  <div className="person-row__copy">
                    <h4>{user.displayName}</h4>
                    <p>{user.subtitle}</p>
                  </div>
                  <span className="status-pill status-pill--connected">
                    {user.status === 'online' ? 'Online' : 'Available'}
                  </span>
                </button>
              ))}

              {!filteredUsers.length ? (
                <div className="empty-state">
                  No users matched that search. Try a different username.
                </div>
              ) : null}
            </div>
          )}
        </MotionDiv>
      ) : null}

      <div className="chat-list">
        {filteredChats.map((chat) => (
          <button
            className={`chat-list-item ${selectedChatId === chat.id ? 'chat-list-item--active' : ''}`}
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            type="button"
          >
            <div className="chat-list-item__row">
              <div className="avatar">{chat.displayName.slice(0, 1).toUpperCase()}</div>

              <div className="chat-list-item__copy">
                <h3>{chat.displayName}</h3>
                <p>{formatLastMessage(chat)}</p>
              </div>

              <time>{formatLastTime(chat)}</time>
            </div>
          </button>
        ))}

        {!filteredChats.length ? (
          <div className="empty-state">
            No chats match that search yet. Try starting a new one.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
