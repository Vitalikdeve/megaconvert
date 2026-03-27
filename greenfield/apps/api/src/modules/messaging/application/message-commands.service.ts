import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditShellService } from '../../audit-shell/application/audit-shell.service';

import { MessagingDomainError } from '../domain/messaging.errors';
import { MESSAGING_REPOSITORY } from '../messaging.constants';

import { MessagingRealtimeService } from './messaging-realtime.service';

import type { MessagingRepository } from './messaging.repository';
import type {
  EditMessageInput,
  SendMessageInput,
  UpdateReadStateInput,
} from '@megaconvert/contracts';

@Injectable()
export class MessageCommandsService {
  public constructor(
    @Inject(AuditShellService)
    private readonly auditShellService: AuditShellService,
    @Inject(MessagingRealtimeService)
    private readonly messagingRealtimeService: MessagingRealtimeService,
    @Inject(MESSAGING_REPOSITORY)
    private readonly messagingRepository: MessagingRepository,
  ) {}

  public async deleteMessage(actorUserId: string, conversationId: string, messageId: string) {
    try {
      const result = await this.messagingRepository.deleteMessage(actorUserId, conversationId, messageId);

      await this.auditShellService.record({
        action: 'messaging.message.deleted',
        category: 'messaging',
        metadata: {
          conversationId,
          messageId,
        },
        target: {
          id: messageId,
          type: 'message',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishMessageDeleted(conversationId, result.message),
        this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
          conversationId,
          reason: 'message_deleted',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.message;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async editMessage(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    input: EditMessageInput,
  ) {
    try {
      const result = await this.messagingRepository.editMessage(
        actorUserId,
        conversationId,
        messageId,
        input,
      );

      await this.auditShellService.record({
        action: 'messaging.message.edited',
        category: 'messaging',
        metadata: {
          conversationId,
          messageId,
        },
        target: {
          id: messageId,
          type: 'message',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishMessageUpdated(conversationId, result.message),
        this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
          conversationId,
          reason: 'message_updated',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.message;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async removeReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ) {
    try {
      const result = await this.messagingRepository.removeReaction(
        actorUserId,
        conversationId,
        messageId,
        reaction,
      );

      await this.auditShellService.record({
        action: 'messaging.reaction.removed',
        category: 'messaging',
        metadata: {
          conversationId,
          messageId,
          reaction,
        },
        target: {
          id: messageId,
          type: 'message',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishMessageUpdated(conversationId, result.message),
        this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
          conversationId,
          reason: 'reaction_updated',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.message;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async sendMessage(
    actorUserId: string,
    conversationId: string,
    input: SendMessageInput,
  ) {
    try {
      const result = await this.messagingRepository.sendMessage(actorUserId, conversationId, input);

      await this.auditShellService.record({
        action: 'messaging.message.sent',
        category: 'messaging',
        metadata: {
          conversationId,
          messageId: result.message.id,
          replyToMessageId: input.replyToMessageId ?? null,
        },
        target: {
          id: result.message.id,
          type: 'message',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishMessageCreated(conversationId, result.message),
        this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
          conversationId,
          reason: 'message_sent',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.message;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async updateReadState(
    actorUserId: string,
    conversationId: string,
    input: UpdateReadStateInput,
  ) {
    try {
      const result = await this.messagingRepository.updateReadState(actorUserId, conversationId, input);

      await this.auditShellService.record({
        action: 'messaging.read_state.updated',
        category: 'messaging',
        metadata: {
          conversationId,
          lastReadSequence: result.readState.lastReadSequence,
        },
        target: {
          id: conversationId,
          type: 'conversation',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishReadStateUpdated(
          conversationId,
          actorUserId,
          result.readState,
        ),
        this.messagingRealtimeService.publishInboxChanged([actorUserId], {
          conversationId,
          reason: 'read_state_updated',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.readState;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async upsertReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ) {
    try {
      const result = await this.messagingRepository.upsertReaction(
        actorUserId,
        conversationId,
        messageId,
        reaction,
      );

      await this.auditShellService.record({
        action: 'messaging.reaction.added',
        category: 'messaging',
        metadata: {
          conversationId,
          messageId,
          reaction,
        },
        target: {
          id: messageId,
          type: 'message',
        },
      });

      await Promise.all([
        this.messagingRealtimeService.publishMessageUpdated(conversationId, result.message),
        this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
          conversationId,
          reason: 'reaction_updated',
          type: 'messaging.inbox.changed',
        }),
      ]);

      return result.message;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  private throwMappedMessagingError(error: unknown): never {
    if (!(error instanceof MessagingDomainError)) {
      throw error;
    }

    switch (error.code) {
      case 'conversation_not_found':
      case 'message_not_found':
      case 'participant_not_found':
        throw new NotFoundException({
          code: error.code,
          message: 'The requested messaging resource could not be found.',
        });
      case 'message_delete_not_allowed':
      case 'message_edit_not_allowed':
      case 'blocked_direct_message':
        throw new ForbiddenException({
          code: error.code,
          message: 'The requested messaging operation is not permitted.',
        });
      case 'message_reply_invalid':
      case 'direct_conversation_with_self':
      case 'duplicate_group_members':
      case 'group_members_required':
        throw new BadRequestException({
          code: error.code,
          message: 'The requested messaging payload is not valid.',
        });
      default:
        throw error;
    }
  }
}
