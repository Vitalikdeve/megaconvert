import type {
  ConversationDetail,
  ConversationDraft,
  ConversationListQuery,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  EditMessageInput,
  Message,
  MessageHistoryQuery,
  PaginatedConversations,
  PaginatedMessages,
  ReadState,
  SendMessageInput,
  UpdateConversationDraftInput,
  UpdateReadStateInput,
} from '@megaconvert/contracts';

export interface ConversationMutationResult {
  conversation: ConversationDetail;
  created: boolean;
  memberIds: readonly string[];
}

export interface ConversationDraftMutationResult {
  conversationId: string;
  draft: ConversationDraft | null;
}

export interface MessageMutationResult {
  memberIds: readonly string[];
  message: Message;
}

export interface ReadStateMutationResult {
  conversationId: string;
  memberIds: readonly string[];
  readState: ReadState;
}

export interface MessagingRepository {
  createOrGetDirectConversation(
    actorUserId: string,
    input: CreateDirectConversationInput,
  ): Promise<ConversationMutationResult>;
  createGroupConversation(
    actorUserId: string,
    input: CreateGroupConversationInput,
  ): Promise<ConversationMutationResult>;
  deleteMessage(
    actorUserId: string,
    conversationId: string,
    messageId: string,
  ): Promise<MessageMutationResult>;
  editMessage(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    input: EditMessageInput,
  ): Promise<MessageMutationResult>;
  getConversationDetail(actorUserId: string, conversationId: string): Promise<ConversationDetail>;
  listConversationMessages(
    actorUserId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<PaginatedMessages>;
  listConversations(actorUserId: string, query: ConversationListQuery): Promise<PaginatedConversations>;
  removeReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ): Promise<MessageMutationResult>;
  saveDraft(
    actorUserId: string,
    conversationId: string,
    input: UpdateConversationDraftInput,
  ): Promise<ConversationDraftMutationResult>;
  sendMessage(
    actorUserId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<MessageMutationResult>;
  updateReadState(
    actorUserId: string,
    conversationId: string,
    input: UpdateReadStateInput,
  ): Promise<ReadStateMutationResult>;
  upsertReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ): Promise<MessageMutationResult>;
}
