import type { MessageRepository, StoredMessage } from "../domain/message.entity";

export class ListMessagesUseCase {
  constructor(private readonly repository: MessageRepository) {}

  execute(conversationId: string): Promise<StoredMessage[]> {
    return this.repository.listByConversation(conversationId);
  }
}

