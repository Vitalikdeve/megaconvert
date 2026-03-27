import {
  BadRequestException,
  ConflictException,
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
  ConversationDetail,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  UpdateConversationDraftInput,
} from '@megaconvert/contracts';

@Injectable()
export class ConversationCommandsService {
  public constructor(
    @Inject(AuditShellService)
    private readonly auditShellService: AuditShellService,
    @Inject(MessagingRealtimeService)
    private readonly messagingRealtimeService: MessagingRealtimeService,
    @Inject(MESSAGING_REPOSITORY)
    private readonly messagingRepository: MessagingRepository,
  ) {}

  public async createDirectConversation(
    actorUserId: string,
    input: CreateDirectConversationInput,
  ): Promise<ConversationDetail> {
    try {
      const result = await this.messagingRepository.createOrGetDirectConversation(actorUserId, input);

      await this.auditShellService.record({
        action: result.created ? 'messaging.direct_chat.created' : 'messaging.direct_chat.reused',
        category: 'messaging',
        metadata: {
          conversationId: result.conversation.id,
          participantUsername: input.participantUsername,
        },
        target: {
          id: result.conversation.id,
          type: 'conversation',
        },
      });

      await this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
        conversationId: result.conversation.id,
        reason: 'conversation_created',
        type: 'messaging.inbox.changed',
      });

      return result.conversation;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async createGroupConversation(
    actorUserId: string,
    input: CreateGroupConversationInput,
  ): Promise<ConversationDetail> {
    try {
      const result = await this.messagingRepository.createGroupConversation(actorUserId, input);

      await this.auditShellService.record({
        action: 'messaging.group_chat.created',
        category: 'messaging',
        metadata: {
          conversationId: result.conversation.id,
          invitedUsernames: input.memberUsernames,
          title: input.title,
        },
        target: {
          id: result.conversation.id,
          type: 'conversation',
        },
      });

      await this.messagingRealtimeService.publishInboxChanged(result.memberIds, {
        conversationId: result.conversation.id,
        reason: 'conversation_created',
        type: 'messaging.inbox.changed',
      });

      return result.conversation;
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  public async saveDraft(
    actorUserId: string,
    conversationId: string,
    input: UpdateConversationDraftInput,
  ) {
    try {
      const result = await this.messagingRepository.saveDraft(actorUserId, conversationId, input);

      await this.auditShellService.record({
        action: 'messaging.draft.updated',
        category: 'messaging',
        metadata: {
          conversationId,
          hasBody: result.draft !== null && result.draft.body.length > 0,
          replyToMessageId: result.draft?.replyToMessageId ?? null,
        },
        target: {
          id: conversationId,
          type: 'conversation',
        },
      });

      await this.messagingRealtimeService.publishInboxChanged([actorUserId], {
        conversationId,
        reason: 'draft_updated',
        type: 'messaging.inbox.changed',
      });

      return {
        draft: result.draft,
      };
    } catch (error) {
      this.throwMappedMessagingError(error);
    }
  }

  private throwMappedMessagingError(error: unknown): never {
    if (!(error instanceof MessagingDomainError)) {
      throw error;
    }

    switch (error.code) {
      case 'blocked_direct_message':
        throw new ForbiddenException({
          code: error.code,
          message: 'A direct conversation cannot be created because one participant has blocked the other.',
        });
      case 'conversation_not_found':
      case 'participant_not_found':
        throw new NotFoundException({
          code: error.code,
          message: 'The requested conversation participant could not be found.',
        });
      case 'duplicate_group_members':
      case 'group_members_required':
      case 'message_reply_invalid':
      case 'direct_conversation_with_self':
        throw new BadRequestException({
          code: error.code,
          message: 'The requested messaging operation is not valid.',
        });
      default:
        throw new ConflictException({
          code: error.code,
          message: 'The conversation command could not be completed.',
        });
    }
  }
}
