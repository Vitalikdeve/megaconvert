import { Inject, Injectable } from '@nestjs/common';

import { NotFoundException } from '@nestjs/common';

import { MessagingDomainError } from '../domain/messaging.errors';
import { MESSAGING_REPOSITORY } from '../messaging.constants';

import type { MessagingRepository } from './messaging.repository';
import type { MessageHistoryQuery, PaginatedMessages } from '@megaconvert/contracts';

@Injectable()
export class MessageQueriesService {
  public constructor(
    @Inject(MESSAGING_REPOSITORY)
    private readonly messagingRepository: MessagingRepository,
  ) {}

  public async listConversationMessages(
    actorUserId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<PaginatedMessages> {
    try {
      return this.messagingRepository.listConversationMessages(actorUserId, conversationId, query);
    } catch (error) {
      if (error instanceof MessagingDomainError && error.code === 'conversation_not_found') {
        throw new NotFoundException({
          code: error.code,
          message: 'The requested conversation could not be found.',
        });
      }

      throw error;
    }
  }
}
