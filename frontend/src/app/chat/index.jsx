import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatSidebar from '../../components/ChatSidebar.jsx';
import ChatWindow from '../../components/ChatWindow.jsx';
import MessageInput from '../../components/MessageInput.jsx';

const MotionDiv = motion.div;
const MotionSection = motion.section;

export default function ChatPage({
  activeChat,
  chats,
  connectionState,
  currentUser,
  messages,
  onCreateChat,
  onLogout,
  onSelectChat,
  onSendMessage,
  users,
  usersError,
  usersLoading,
}) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [composerValue, setComposerValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);

  const availableUsers = useMemo(
    () => users.filter((user) => !chats.some((chat) => chat.userId === user.id)),
    [chats, users]
  );

  const handleSelectChat = (chatId) => {
    onSelectChat(chatId);
    setIsMobileThreadOpen(true);
  };

  const handleCreateChat = (user) => {
    onCreateChat(user);
    setIsComposerOpen(false);
    setIsMobileThreadOpen(true);
  };

  const handleSend = () => {
    if (!composerValue.trim() && attachments.length === 0) {
      return;
    }

    onSendMessage({
      text: composerValue,
      attachments,
    });
    setComposerValue('');
    setAttachments([]);
  };

  const handleCreateMeeting = () => {
    const roomId = Math.random().toString(36).slice(2, 9);
    navigate(`/meet/${roomId}`);
  };

  return (
    <div className={`messenger-shell ${isMobileThreadOpen ? 'messenger-shell--thread-open' : ''}`}>
      <MotionDiv
        animate={{ opacity: 1, x: 0 }}
        className="messenger-shell__sidebar"
        initial={{ opacity: 0, x: -18 }}
      >
        <ChatSidebar
          chats={chats}
          connectionState={connectionState}
          currentUser={currentUser}
          isComposerOpen={isComposerOpen}
          onCreateMeeting={handleCreateMeeting}
          onCreateChat={handleCreateChat}
          onLogout={onLogout}
          onSearchChange={setSearchValue}
          onSelectChat={handleSelectChat}
          onToggleComposer={() => setIsComposerOpen((currentState) => !currentState)}
          searchValue={searchValue}
          selectedChatId={activeChat?.id ?? null}
          users={availableUsers}
          usersError={usersError}
          usersLoading={usersLoading}
        />
      </MotionDiv>

      <MotionSection
        animate={{ opacity: 1, x: 0 }}
        className="glass-panel chat-panel"
        initial={{ opacity: 0, x: 18 }}
      >
        <ChatWindow
          activeChat={activeChat}
          currentUser={currentUser}
          messages={messages}
          onBack={() => setIsMobileThreadOpen(false)}
        />

        <MessageInput
          attachments={attachments}
          disabled={!activeChat}
          onAttachmentsChange={(files) =>
            setAttachments((currentFiles) => [...currentFiles, ...files])
          }
          onRemoveAttachment={(indexToRemove) =>
            setAttachments((currentFiles) =>
              currentFiles.filter((_, fileIndex) => fileIndex !== indexToRemove)
            )
          }
          onSend={handleSend}
          onValueChange={setComposerValue}
          value={composerValue}
        />
      </MotionSection>
    </div>
  );
}
