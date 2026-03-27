import {
  conversationListQuerySchema,
  conversationRouteParamsSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  updateConversationDraftSchema,
} from '@megaconvert/contracts';
import {
  UseResponseEnvelope,
  createZodDto,
  ZodValidationPipe,
} from '@megaconvert/server-kit';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentActor } from '../../../auth-shell/interfaces/http/current-actor.decorator';
import { UserActorGuard } from '../../../users/interfaces/http/user-actor.guard';
import { ConversationCommandsService } from '../../application/conversation-commands.service';
import { ConversationQueriesService } from '../../application/conversation-queries.service';

import type { UserActor } from '../../../auth-shell/domain/request-actor';
import type {
  ConversationListQuery,
  ConversationRouteParams,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  UpdateConversationDraftInput,
} from '@megaconvert/contracts';

const ConversationListQueryDto = createZodDto(conversationListQuerySchema);
const ConversationRouteParamsDto = createZodDto(conversationRouteParamsSchema);
const CreateDirectConversationDto = createZodDto(createDirectConversationSchema);
const CreateGroupConversationDto = createZodDto(createGroupConversationSchema);
const UpdateConversationDraftDto = createZodDto(updateConversationDraftSchema);

@Controller('messaging/conversations')
@UseGuards(UserActorGuard)
export class ConversationsController {
  public constructor(
    @Inject(ConversationCommandsService)
    private readonly conversationCommandsService: ConversationCommandsService,
    @Inject(ConversationQueriesService)
    private readonly conversationQueriesService: ConversationQueriesService,
  ) {}

  @Post('direct')
  @UseResponseEnvelope()
  public async createDirectConversation(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(CreateDirectConversationDto))
    input: CreateDirectConversationInput,
  ) {
    return this.conversationCommandsService.createDirectConversation(actor.id, input);
  }

  @Post('group')
  @UseResponseEnvelope()
  public async createGroupConversation(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(CreateGroupConversationDto))
    input: CreateGroupConversationInput,
  ) {
    return this.conversationCommandsService.createGroupConversation(actor.id, input);
  }

  @Get()
  @UseResponseEnvelope()
  public async listConversations(
    @CurrentActor() actor: UserActor,
    @Query(new ZodValidationPipe(ConversationListQueryDto)) query: ConversationListQuery,
  ) {
    return this.conversationQueriesService.listConversations(actor.id, query);
  }

  @Get(':conversationId')
  @UseResponseEnvelope()
  public async getConversationDetail(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ConversationRouteParamsDto))
    params: ConversationRouteParams,
  ) {
    return this.conversationQueriesService.getConversationDetail(actor.id, params.conversationId);
  }

  @Put(':conversationId/draft')
  @UseResponseEnvelope()
  public async updateDraft(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ConversationRouteParamsDto))
    params: ConversationRouteParams,
    @Body(new ZodValidationPipe(UpdateConversationDraftDto))
    input: UpdateConversationDraftInput,
  ) {
    return this.conversationCommandsService.saveDraft(actor.id, params.conversationId, input);
  }
}
