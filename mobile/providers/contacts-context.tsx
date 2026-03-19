import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/providers/auth-context';

export type Contact = {
  id: string;
  fullName: string;
  username: string;
  avatarUri: string | null;
  isPro: boolean;
};

export type FriendRequest = {
  id: string;
  direction: 'incoming' | 'outgoing';
  fullName: string;
  username: string;
  avatarUri: string | null;
  createdAt: string;
};

type SendRequestResult = {
  status: 'sent' | 'exists' | 'pending';
  username: string;
};

type ContactsContextValue = {
  contacts: Contact[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  cancelOutgoingRequest: (requestId: string) => Promise<void>;
  sendRequestByQrData: (rawQrData: string) => Promise<SendRequestResult>;
};

const ContactsContext = createContext<ContactsContextValue | undefined>(undefined);

const mockContacts: Contact[] = [
  {
    id: 'c-1',
    fullName: 'Екатерина Соколова',
    username: 'katya_sales',
    avatarUri: null,
    isPro: true,
  },
];

const mockIncoming: FriendRequest[] = [
  {
    id: 'in-1',
    direction: 'incoming',
    fullName: 'Андрей Кравцов',
    username: 'andrey_kravtsov',
    avatarUri: null,
    createdAt: '2026-03-19T08:15:00.000Z',
  },
];

const mockOutgoing: FriendRequest[] = [
  {
    id: 'out-1',
    direction: 'outgoing',
    fullName: 'Марина Юрьева',
    username: 'marina_yuryeva',
    avatarUri: null,
    createdAt: '2026-03-19T09:02:00.000Z',
  },
];

type ParsedQrContact = {
  userId: string | null;
  username: string;
};

function normalizeUsername(rawValue: string): string {
  return rawValue.trim().replace(/^@+/, '').toLowerCase();
}

function parseQrData(rawQrData: string): ParsedQrContact {
  const trimmed = rawQrData.trim();
  if (!trimmed) {
    throw new Error('QR_EMPTY');
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<{ type: string; userId: string; username: string; id: string }>;
    if (parsed.type === 'megaconvert-contact' && (parsed.username || parsed.id || parsed.userId)) {
      return {
        userId: parsed.userId || parsed.id || null,
        username: normalizeUsername(parsed.username || ''),
      };
    }
  } catch {
    // QR value can be plain username; this is expected.
  }

  const maybeUsername = normalizeUsername(trimmed);
  if (!maybeUsername) {
    throw new Error('QR_INVALID');
  }

  return {
    userId: null,
    username: maybeUsername,
  };
}

function getApiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

export function ContactsProvider({ children }: PropsWithChildren) {
  const { googleAccount, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const refresh = async () => {
    if (!googleAccount || !profile) {
      setContacts([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (!apiBaseUrl) {
        setContacts(mockContacts);
        setIncomingRequests(mockIncoming);
        setOutgoingRequests(mockOutgoing);
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/mobile/contacts`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('CONTACTS_LOAD_FAILED');
      }

      const payload = (await response.json()) as Partial<{
        contacts: Contact[];
        incomingRequests: FriendRequest[];
        outgoingRequests: FriendRequest[];
      }>;

      setContacts(payload.contacts ?? []);
      setIncomingRequests(payload.incomingRequests ?? []);
      setOutgoingRequests(payload.outgoingRequests ?? []);
    } catch {
      setErrorMessage('Не удалось загрузить контакты. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // We intentionally refresh only when identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleAccount?.id, profile?.username]);

  const acceptRequest = async (requestId: string) => {
    const request = incomingRequests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    if (!apiBaseUrl) {
      setIncomingRequests((prev) => prev.filter((item) => item.id !== requestId));
      setContacts((prev) => [
        {
          id: `contact-${request.id}`,
          fullName: request.fullName,
          username: request.username,
          avatarUri: request.avatarUri,
          isPro: true,
        },
        ...prev,
      ]);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/mobile/contacts/requests/${requestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('REQUEST_ACCEPT_FAILED');
    }

    await refresh();
  };

  const declineRequest = async (requestId: string) => {
    if (!apiBaseUrl) {
      setIncomingRequests((prev) => prev.filter((item) => item.id !== requestId));
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/mobile/contacts/requests/${requestId}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('REQUEST_DECLINE_FAILED');
    }

    await refresh();
  };

  const cancelOutgoingRequest = async (requestId: string) => {
    if (!apiBaseUrl) {
      setOutgoingRequests((prev) => prev.filter((item) => item.id !== requestId));
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/mobile/contacts/requests/${requestId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('REQUEST_CANCEL_FAILED');
    }

    await refresh();
  };

  const sendRequestByQrData = async (rawQrData: string): Promise<SendRequestResult> => {
    if (!googleAccount || !profile) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const parsed = parseQrData(rawQrData);
    const resolvedUsername = parsed.username || 'пользователь';
    if (!parsed.username && !parsed.userId) {
      throw new Error('QR_INVALID');
    }

    if (parsed.username && parsed.username === profile.username) {
      throw new Error('SELF_ADD');
    }

    const existingContact = contacts.find((item) => item.username === parsed.username);
    if (existingContact) {
      return { status: 'exists', username: existingContact.username };
    }

    const existingPending = outgoingRequests.find((item) => item.username === parsed.username);
    if (existingPending) {
      return { status: 'pending', username: existingPending.username };
    }

    if (!apiBaseUrl) {
      const usernameForUi = parsed.username || `user_${Date.now().toString().slice(-6)}`;
      const nextRequest: FriendRequest = {
        id: `out-${Date.now()}`,
        direction: 'outgoing',
        fullName: `Пользователь @${usernameForUi}`,
        username: usernameForUi,
        avatarUri: null,
        createdAt: new Date().toISOString(),
      };
      setOutgoingRequests((prev) => [nextRequest, ...prev]);
      return { status: 'sent', username: usernameForUi };
    }

    const response = await fetch(`${apiBaseUrl}/api/mobile/contacts/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserId: parsed.userId,
        targetUsername: parsed.username || null,
      }),
    });

    if (response.status === 409) {
      return { status: 'pending', username: resolvedUsername };
    }

    if (!response.ok) {
      throw new Error('REQUEST_SEND_FAILED');
    }

    await refresh();
    return { status: 'sent', username: resolvedUsername };
  };

  const value = useMemo<ContactsContextValue>(
    () => ({
      contacts,
      incomingRequests,
      outgoingRequests,
      isLoading,
      errorMessage,
      refresh,
      acceptRequest,
      declineRequest,
      cancelOutgoingRequest,
      sendRequestByQrData,
    }),
    [
      contacts,
      incomingRequests,
      outgoingRequests,
      isLoading,
      errorMessage,
      refresh,
      acceptRequest,
      declineRequest,
      cancelOutgoingRequest,
      sendRequestByQrData,
    ]
  );

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within ContactsProvider');
  }
  return context;
}
