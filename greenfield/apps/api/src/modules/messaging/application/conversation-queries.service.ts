import { Inject, Injectable } from '@nestjs/common';

import { MessagingDomainError } from '../domain/messaging.errors';
import { MESSAGING_REPOSITORY } from '../messaging.constants';

import type { MessagingRepository } from './messaging.repository';
import type {
  ConversationDetail,
  ConversationListQuery,
  PaginatedConversations,
} from '@megaconvert/contracts';
import { NotFoundException as NestNotFoundException } from '@nestjs/common';

@Injectable()
export class ConversationQueriesService {
  public constructor(
    @Inject(MESSAGING_REPOSITORY)
    private readonly messagingRepository: MessagingRepository,
  ) {}

  public async getConversationDetail(
    actorUserId: string,
    conversationId: string,
  ): Promise<ConversationDetail> {
    try {
      return this.messagingRepository.getConversationDetail(actorUserId, conversationId);
    } catch (error) {
      this.throwMappedQueryError(error);
    }
  }

  public async listConversations(
    actorUserId: string,
    query: ConversationListQuery,
  ): Promise<PaginatedConversations> {
    return this.messagingRepository.listConversations(actorUserId, query);
  }

  private throwMappedQueryError(error: unknown): never {
    if (error instanceof MessagingDomainError && error.code === 'conversation_not_found') {
      throw new NestNotFoundException({
        code: error.code,
        message: 'The requested conversation could not be found.',
      });
    }

    throw error;
  }
}
