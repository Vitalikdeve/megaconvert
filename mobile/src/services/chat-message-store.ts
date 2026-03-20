export type ChatStoreMessage = {
  id: string;
  sender: 'me' | 'contact';
  kind: 'text' | 'file';
  text: string;
  createdAt: string;
  transport?: 'internet' | 'mesh' | 'local';
};

type ThreadListener = (messages: ChatStoreMessage[]) => void;

const threadMessages = new Map<string, ChatStoreMessage[]>();
const threadListeners = new Map<string, Set<ThreadListener>>();

function normalizeThreadId(rawThreadId: string): string {
  return String(rawThreadId || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function emitThreadUpdate(threadId: string) {
  const listeners = threadListeners.get(threadId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const payload = [...(threadMessages.get(threadId) || [])];
  listeners.forEach((listener) => listener(payload));
}

function generateMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export function hydrateThreadMessages(threadId: string, seedMessages: ChatStoreMessage[]): ChatStoreMessage[] {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    return [...seedMessages];
  }

  if (!threadMessages.has(normalizedThreadId)) {
    threadMessages.set(normalizedThreadId, [...seedMessages]);
  }
  return [...(threadMessages.get(normalizedThreadId) || [])];
}

export function subscribeThreadMessages(
  threadId: string,
  listener: (messages: ChatStoreMessage[]) => void
): () => void {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    listener([]);
    return () => undefined;
  }

  const listeners = threadListeners.get(normalizedThreadId) || new Set<ThreadListener>();
  listeners.add(listener);
  threadListeners.set(normalizedThreadId, listeners);

  listener([...(threadMessages.get(normalizedThreadId) || [])]);

  return () => {
    const currentListeners = threadListeners.get(normalizedThreadId);
    if (!currentListeners) {
      return;
    }
    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      threadListeners.delete(normalizedThreadId);
    }
  };
}

export function appendThreadMessage(threadId: string, message: ChatStoreMessage): ChatStoreMessage {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    return message;
  }

  const currentMessages = threadMessages.get(normalizedThreadId) || [];
  const nextMessages = [message, ...currentMessages];
  threadMessages.set(normalizedThreadId, nextMessages);
  emitThreadUpdate(normalizedThreadId);
  return message;
}

export function buildOutgoingMessage(
  text: string,
  kind: 'text' | 'file',
  transport?: 'internet' | 'mesh' | 'local'
): ChatStoreMessage {
  return {
    id: generateMessageId(kind === 'file' ? 'file' : 'msg'),
    sender: 'me',
    kind,
    text,
    transport,
    createdAt: new Date().toISOString(),
  };
}

export function appendIncomingMeshMessage(senderId: string, text: string): ChatStoreMessage {
  const threadId = normalizeThreadId(senderId);
  const incoming: ChatStoreMessage = {
    id: generateMessageId('mesh-in'),
    sender: 'contact',
    kind: 'text',
    text,
    transport: 'mesh',
    createdAt: new Date().toISOString(),
  };
  return appendThreadMessage(threadId, incoming);
}

export function normalizeThreadKey(value: string): string {
  return normalizeThreadId(value);
}
