import type { EditMessageInput, MessageEnvelope, ReactionInput } from "@messenger/shared";

import type { MessageRepository, StoredMessage } from "../domain/message.entity";

export class EditMessageUseCase {
  constructor(private readonly repository: MessageRepository) {}

  execute(messageId: string, editorUserId: string, envelope: MessageEnvelope): Promise<StoredMessage | null> {
    return this.repository.edit(messageId, editorUserId, envelope);
  }

  executeFromInput(input: EditMessageInput): Promise<StoredMessage | null> {
    return this.repository.edit(input.messageId, input.editorUserId, input.envelope);
  }
}

export class ReactToMessageUseCase {
  constructor(private readonly repository: MessageRepository) {}

  execute(input: ReactionInput): Promise<StoredMessage | null> {
    return this.repository.addReaction(input);
  }
}

