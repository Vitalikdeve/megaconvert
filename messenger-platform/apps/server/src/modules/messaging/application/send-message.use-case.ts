import type { SendMessageInput } from "@messenger/shared";

import type { MessageRepository, StoredMessage } from "../domain/message.entity";

export class SendMessageUseCase {
  constructor(private readonly repository: MessageRepository) {}

  execute(input: SendMessageInput): Promise<StoredMessage> {
    return this.repository.save({
      clientMessageId: input.clientMessageId,
      conversationId: input.conversationId,
      senderUserId: input.senderUserId,
      senderDeviceId: input.senderDeviceId,
      envelope: input.envelope
    });
  }
}
