import type {
  MessageEnvelope,
  ReactionInput,
  StoredMessage
} from "@messenger/shared";

export type { StoredMessage } from "@messenger/shared";

export interface CreateMessageRecord {
  clientMessageId: string;
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  envelope: MessageEnvelope;
}

export interface MessageRepository {
  save(input: CreateMessageRecord): Promise<StoredMessage>;
  listByConversation(conversationId: string): Promise<StoredMessage[]>;
  edit(messageId: string, editorUserId: string, envelope: MessageEnvelope): Promise<StoredMessage | null>;
  addReaction(input: ReactionInput): Promise<StoredMessage | null>;
}
