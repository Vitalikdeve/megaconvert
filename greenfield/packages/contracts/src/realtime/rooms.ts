export function buildConversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function buildUserRoom(userId: string): string {
  return `user:${userId}`;
}
