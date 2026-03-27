import type { ConversationDetail, ConversationSummary, Message, UserProfileCard } from '@megaconvert/contracts';

type ConversationView = ConversationDetail | ConversationSummary;

export function getConversationLabel(conversation: ConversationView): string {
  if (conversation.kind === 'group') {
    return conversation.title ?? 'Untitled group';
  }

  const counterpart = conversation.counterpartProfiles[0];

  if (!counterpart) {
    return 'Direct chat';
  }

  return counterpart.displayName;
}

export function getConversationSupportingText(conversation: ConversationView): string {
  if (conversation.kind === 'group') {
    return `${conversation.memberCount} members`;
  }

  const counterpart = conversation.counterpartProfiles[0];

  if (!counterpart) {
    return 'No counterpart available';
  }

  return `@${counterpart.username}`;
}

export function getConversationPreview(conversation: ConversationView): string {
  if (conversation.draft?.body) {
    return `Draft: ${conversation.draft.body}`;
  }

  if (!conversation.lastMessage) {
    return conversation.kind === 'group'
      ? 'No messages yet. Start the room with a kickoff note.'
      : 'No messages yet. Start the conversation.';
  }

  if (conversation.lastMessage.kind === 'system') {
    return conversation.lastMessage.bodyPreview ?? 'System update';
  }

  const authorPrefix = conversation.lastMessage.author?.displayName
    ? `${conversation.lastMessage.author.displayName}: `
    : '';

  return `${authorPrefix}${conversation.lastMessage.bodyPreview ?? 'Message unavailable'}`;
}

export function getMessageAuthorLabel(
  message: Message,
  currentUserId: string | null,
): string {
  if (message.kind === 'system') {
    return 'System';
  }

  if (message.author?.id && currentUserId && message.author.id === currentUserId) {
    return 'You';
  }

  return message.author?.displayName ?? 'Unknown member';
}

export function isOwnMessage(message: Message, currentUserId: string | null): boolean {
  return Boolean(currentUserId && message.author?.id === currentUserId);
}

export function formatConversationTimestamp(timestamp: string): string {
  return formatAdaptiveTimestamp(timestamp);
}

export function formatMessageTimestamp(timestamp: string): string {
  return formatAdaptiveTimestamp(timestamp, true);
}

export function getTypingSummary(
  typingParticipants: readonly UserProfileCard[],
): string | null {
  if (typingParticipants.length === 0) {
    return null;
  }

  if (typingParticipants.length === 1) {
    return `${typingParticipants[0]!.displayName} is typing...`;
  }

  if (typingParticipants.length === 2) {
    return `${typingParticipants[0]!.displayName} and ${typingParticipants[1]!.displayName} are typing...`;
  }

  return `${typingParticipants[0]!.displayName} and ${typingParticipants.length - 1} others are typing...`;
}

function formatAdaptiveTimestamp(timestamp: string, includeTime = false): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: includeTime ? 'numeric' : undefined,
    minute: includeTime ? '2-digit' : undefined,
    month: 'short',
  }).format(date);
}
