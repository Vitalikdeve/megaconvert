import {
  buildConversationRoom,
  buildUserRoom,
  messagingTransportEnvelopeSchema,
  type InboxChangedEvent,
  type Message,
  type MessagingServerEvent,
  type ReadState,
} from '@megaconvert/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { RealtimeShellService } from '../../realtime-shell/application/realtime-shell.service';

@Injectable()
export class MessagingRealtimeService {
  public constructor(
    @Inject(RealtimeShellService)
    private readonly realtimeShellService: RealtimeShellService,
  ) {}

  public async publishInboxChanged(
    userIds: readonly string[],
    event: InboxChangedEvent,
  ): Promise<void> {
    await this.publish(event, userIds.map(buildUserRoom));
  }

  public async publishMessageCreated(conversationId: string, message: Message): Promise<void> {
    await this.publish(
      {
        conversationId,
        message,
        type: 'messaging.message.created',
      },
      [buildConversationRoom(conversationId)],
    );
  }

  public async publishMessageDeleted(conversationId: string, message: Message): Promise<void> {
    await this.publish(
      {
        conversationId,
        message,
        type: 'messaging.message.deleted',
      },
      [buildConversationRoom(conversationId)],
    );
  }

  public async publishMessageUpdated(conversationId: string, message: Message): Promise<void> {
    await this.publish(
      {
        conversationId,
        message,
        type: 'messaging.message.updated',
      },
      [buildConversationRoom(conversationId)],
    );
  }

  public async publishReadStateUpdated(
    conversationId: string,
    userId: string,
    readState: ReadState,
  ): Promise<void> {
    await this.publish(
      {
        conversationId,
        readState: {
          ...readState,
          userId,
        },
        type: 'messaging.read-state.updated',
      },
      [buildConversationRoom(conversationId)],
    );
  }

  private async publish(
    event: MessagingServerEvent,
    targetRooms: readonly string[],
  ): Promise<void> {
    if (targetRooms.length === 0) {
      return;
    }

    const payload = messagingTransportEnvelopeSchema.parse({
      event,
      targetRooms,
    });

    await this.realtimeShellService.publish({
      channel: 'messaging.transport',
      payload,
      type: event.type,
    });
  }
}
