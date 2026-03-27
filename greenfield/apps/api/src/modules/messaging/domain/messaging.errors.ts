export type MessagingDomainErrorCode =
  | 'blocked_direct_message'
  | 'conversation_not_found'
  | 'direct_conversation_with_self'
  | 'duplicate_group_members'
  | 'group_members_required'
  | 'message_delete_not_allowed'
  | 'message_edit_not_allowed'
  | 'message_not_found'
  | 'message_reply_invalid'
  | 'participant_not_found';

export class MessagingDomainError extends Error {
  public constructor(public readonly code: MessagingDomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'MessagingDomainError';
  }
}
