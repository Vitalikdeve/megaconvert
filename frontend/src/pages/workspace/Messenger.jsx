import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search,
  SendHorizontal,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import useMessengerKeys from '../../hooks/useMessengerKeys.js';

const normalizeRealtimeBase = () => {
  if (typeof window === 'undefined') return '';
  const configured = String(import.meta.env.VITE_SIGNALING_URL || import.meta.env.VITE_API_BASE || '').trim();
  if (!configured) return window.location.origin;
  if (!/^(https?|wss?):\/\//i.test(configured)) return window.location.origin;
  return configured.replace(/\/+$/g, '');
};

function MessengerLayout({
  contacts,
  activeContactId,
  onSelectContact,
  messagesByContact,
  onSendMessage,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);
  const [messageInput, setMessageInput] = useState('');

  const activeContact = useMemo(
    () => contacts.find((item) => item.id === activeContactId) || null,
    [activeContactId, contacts],
  );

  const handleSelectContact = (contactId) => {
    onSelectContact(contactId);
    setShowSidebarOnMobile(false);
  };

  const filteredContacts = useMemo(
    () => contacts.filter((item) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const query = searchQuery.trim().toLowerCase();
      return (
        String(item.name || '')
          .toLowerCase()
          .includes(query)
        || String(item.lastMessage || '')
          .toLowerCase()
          .includes(query)
      );
    }),
    [contacts, searchQuery],
  );

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageInput.trim()) {
      return;
    }
    try {
      await onSendMessage(activeContact.id, messageInput.trim());
      setMessageInput('');
    } catch (error) {
      console.error('[messenger] send failed:', error);
      toast.error(
        t('messenger.sendFailed', 'Unable to send secure message. Please try again.'),
      );
    }
  };

  const showChatPanel = Boolean(activeContact) && (!showSidebarOnMobile);

  return (
    <div className="flex h-screen w-full bg-[#0A0A0B] text-white overflow-hidden">
      {/* Sidebar (contacts) */}
      <aside
        className={[
          'flex h-full w-full max-w-[360px] flex-col border-r border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,10,12,0.98),rgba(5,5,8,1))] transition-transform duration-300 md:w-[320px]',
          showSidebarOnMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-emerald-100/80">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            {t('messenger.eyebrow', 'Messages')}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/82 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.9)] hover:bg-white/[0.08]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">
              {t('messenger.addContact', 'Add Contact')}
            </span>
          </button>
        </div>

        <div className="px-4 pb-3 md:px-5">
          <div className="flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
            <Search className="mr-2 h-4 w-4 text-white/50" strokeWidth={1.8} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('messenger.searchPlaceholder', 'Search contacts...')}
              className="h-8 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 md:px-3">
          {filteredContacts.length === 0 ? (
            <div className="mx-2 mt-6 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-5 text-sm text-white/60">
              <div className="mb-1 text-xs uppercase tracking-[0.26em] text-white/38">
                {t('messenger.emptyStateEyebrow', 'No conversations yet')}
              </div>
              <div>
                {t('messenger.emptyStateBody', 'Add a contact to start an end-to-end encrypted chat.')}
              </div>
            </div>
          ) : null}

          <div className="mt-1 space-y-1">
            {filteredContacts.map((item) => {
              const isActive = item.id === activeContactId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectContact(item.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-white/[0.08] border border-white/[0.16]'
                      : 'border border-transparent hover:border-white/[0.10] hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_0%,rgba(56,189,248,0.5),transparent_55%),linear-gradient(135deg,#10121a,#05060a)] text-sm font-semibold text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    {item.online ? (
                      <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 outline outline-2 outline-[#0A0A0B]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-100" />
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium text-white">
                        {item.name}
                      </div>
                      <div className="shrink-0 text-[11px] text-white/40">
                        {item.time}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-white/50">
                      <div className="truncate">
                        {item.lastMessage}
                      </div>
                      {item.unreadCount ? (
                        <span className="inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                          {item.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Chat area */}
      <main
        className={[
          'flex h-full flex-1 flex-col bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.14),transparent_36%),radial-gradient(circle_at_90%_0%,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,#050509,#020208)]',
          showChatPanel ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
          'transition-transform duration-300',
        ].join(' ')}
      >
        {!activeContact ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/70">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.10] bg-white/[0.04]">
              <MessageCircle className="h-8 w-8 text-white/80" strokeWidth={1.8} />
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/38">
              {t('messenger.emptyChatEyebrow', 'Messages')}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
              {t('messenger.emptyChatTitle', 'Select a contact to start a secure conversation')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
              {t('messenger.emptyChatSubtitle', 'All messages are designed for end-to-end encryption. Your content stays between you and your contact.')}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSidebarOnMobile(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/40 text-white hover:bg-white/[0.08] md:hidden"
                  aria-label={t('messenger.back', 'Back')}
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  <span className="sr-only">{t('messenger.back', 'Back')}</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_0%,rgba(56,189,248,0.5),transparent_55%),linear-gradient(135deg,#10121a,#05060a)] text-sm font-semibold text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] sm:flex">
                    {activeContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-white">
                        {activeContact.name}
                      </div>
                      {activeContact.online ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/16 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          {t('messenger.statusOnline', 'Online')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                          {t('messenger.statusOffline', 'Offline')}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-white/48">
                      <LockKeyhole className="h-3 w-3" strokeWidth={1.8} />
                      <span>{t('messenger.headerSecurity', 'End-to-end encrypted thread')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[11px] text-white/70 sm:flex">
                <UserCircle2 className="h-4 w-4" strokeWidth={1.8} />
                <span>{t('messenger.headerTitle', 'Messages')}</span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
              <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3">
                {(messagesByContact[activeContact.id] || []).map((message) => {
                  const isOwn = message.side === 'right';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={[
                          'max-w-[82%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]',
                          isOwn
                            ? 'border-sky-400/22 bg-sky-400/16 text-white'
                            : 'border-white/[0.10] bg-white/[0.05] text-white/90',
                        ].join(' ')}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-white/42">
                          <span>{message.author}</span>
                          <span>{message.time}</span>
                        </div>
                        <div>{message.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleSendMessage}
              className="border-t border-white/[0.08] bg-black/50 px-3 py-3 sm:px-6 sm:py-4"
            >
              <div className="mx-auto flex w-full max-w-2xl items-end gap-2 rounded-3xl border border-white/[0.10] bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.98))] px-3 py-2 sm:px-4 sm:py-2.5">
                <textarea
                  rows={1}
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder={t('messenger.inputPlaceholder', 'Type a secure message...')}
                  className="max-h-32 flex-1 resize-none bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/30"
                />
                <button
                  type="submit"
                  aria-label={t('messenger.sendLabel', 'Send')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-[0_18px_40px_-24px_rgba(56,189,248,0.8)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default function MessengerPage() {
  const { t } = useTranslation();
  const [messagesByContact, setMessagesByContact] = useState({});
  const socketRef = useRef(null);
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = window.localStorage.getItem('mc_auth_user');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return String(parsed?.id || '').trim();
    } catch {
      return '';
    }
  });
  const apiBase = useMemo(
    () => String(import.meta.env.VITE_API_BASE || '/api').trim() || '/api',
    [],
  );
  const { ready: keysReady, getOrCreateSharedSecret } = useMessengerKeys({
    apiBase,
    userId,
  });

  const contacts = useMemo(() => [
    {
      id: '1',
      name: t('messenger.mockContactAlice', 'Alice, Legal'),
      online: true,
      time: '09:24',
      lastMessage: t('messenger.mockLastMessageAlice', 'I pushed the updated NDA draft.'),
      unreadCount: 2,
      mockMessages: [
        {
          id: 'm1',
          side: 'left',
          author: 'Alice',
          time: '09:18',
          text: t('messenger.mockThreadAlice1', 'Here is the latest NDA version, aligned with your enterprise policies.'),
        },
        {
          id: 'm2',
          side: 'right',
          author: t('messenger.youLabel', 'You'),
          time: '09:20',
          text: t('messenger.mockThreadAlice2', 'Perfect, I will forward it to procurement in this encrypted thread.'),
        },
      ],
    },
    {
      id: '2',
      name: t('messenger.mockContactOps', 'Ops, Nightly Jobs'),
      online: false,
      time: 'Yesterday',
      lastMessage: t('messenger.mockLastMessageOps', 'Analytics export finished without errors.'),
      unreadCount: 0,
      mockMessages: [
        {
          id: 'm3',
          side: 'left',
          author: 'Ops-bot',
          time: '22:14',
          text: t('messenger.mockThreadOps1', 'Your B2B workspace export for finance closed successfully.'),
        },
        {
          id: 'm4',
          side: 'right',
          author: t('messenger.youLabel', 'You'),
          time: '22:17',
          text: t('messenger.mockThreadOps2', 'Thanks, keep posting run summaries here.'),
        },
      ],
    },
  ], [t]);

  const [activeContactId, setActiveContactId] = useState(contacts[0]?.id || null);

  useEffect(() => {
    if (!userId || socketRef.current) {
      return undefined;
    }

    const base = normalizeRealtimeBase();
    const socket = io(base, {
      autoConnect: true,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        userId,
      },
    });

    socketRef.current = socket;

    socket.on('receive-private-message', async (payload) => {
      try {
        const contactId = String(payload?.senderId || payload?.sender_id || '').trim();
        if (!contactId) {
          return;
        }
        const encryptedPayload = payload?.encryptedContent
          || payload?.encrypted_content
          || payload?.encrypted
          || payload?.message
          || null;
        if (!encryptedPayload) {
          return;
        }

        const sharedSecret = await getOrCreateSharedSecret(contactId);
        let plaintext = '';
        try {
          const { decryptMessage } = await import('../../utils/crypto.js');
          plaintext = await decryptMessage(encryptedPayload, sharedSecret);
        } catch (decryptError) {
          console.error('[messenger] decrypt failed:', decryptError);
          toast.error(
            t('messenger.decryptFailed', 'Unable to decrypt message. The contact may have rotated their keys.'),
          );
          return;
        }

        setMessagesByContact((current) => {
          const existing = current[contactId] || [];
          return {
            ...current,
            [contactId]: [
              ...existing,
              {
                id: payload?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                side: 'left',
                author: contacts.find((c) => c.id === contactId)?.name || 'Contact',
                time: payload?.createdAt || payload?.created_at || '',
                text: plaintext,
              },
            ],
          };
        });
      } catch (error) {
        console.error('[messenger] receive handler failed:', error);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [contacts, getOrCreateSharedSecret, t, userId]);

  const handleSendMessage = useCallback(async (contactId, text) => {
    if (!socketRef.current) {
      throw new Error('Socket is not connected.');
    }
    if (!keysReady) {
      throw new Error('Keys are not initialized yet.');
    }

    const sharedSecret = await getOrCreateSharedSecret(contactId);
    const { encryptMessage } = await import('../../utils/crypto.js');
    const encrypted = await encryptMessage(text, sharedSecret);

    const payload = {
      receiverId: contactId,
      encryptedContent: encrypted,
    };

    await new Promise((resolve, reject) => {
      socketRef.current.emit('send-private-message', payload, (response) => {
        if (!response || response.ok === false) {
          reject(new Error(response?.message || 'Failed to send message.'));
          return;
        }
        resolve();
      });
    });

    setMessagesByContact((current) => {
      const existing = current[contactId] || [];
      return {
        ...current,
        [contactId]: [
          ...existing,
          {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            side: 'right',
            author: t('messenger.youLabel', 'You'),
            time: '',
            text,
          },
        ],
      };
    });
  }, [getOrCreateSharedSecret, keysReady, t]);

  return (
    <MessengerLayout
      contacts={contacts}
      activeContactId={activeContactId}
      onSelectContact={setActiveContactId}
      messagesByContact={messagesByContact}
      onSendMessage={handleSendMessage}
    />
  );
}

