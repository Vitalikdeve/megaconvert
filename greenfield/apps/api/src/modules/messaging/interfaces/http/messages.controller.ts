import {
  editMessageSchema,
  messageHistoryQuerySchema,
  messageRouteParamsSchema,
  reactionRouteParamsSchema,
  sendMessageSchema,
  updateReadStateSchema,
} from '@megaconvert/contracts';
import {
  UseResponseEnvelope,
  createZodDto,
  ZodValidationPipe,
} from '@megaconvert/server-kit';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentActor } from '../../../auth-shell/interfaces/http/current-actor.decorator';
import { UserActorGuard } from '../../../users/interfaces/http/user-actor.guard';
import { MessageCommandsService } from '../../application/message-commands.service';
import { MessageQueriesService } from '../../application/message-queries.service';

import type { UserActor } from '../../../auth-shell/domain/request-actor';
import type {
  EditMessageInput,
  MessageHistoryQuery,
  MessageRouteParams,
  ReactionRouteParams,
  SendMessageInput,
  UpdateReadStateInput,
} from '@megaconvert/contracts';

const MessageHistoryQueryDto = createZodDto(messageHistoryQuerySchema);
const MessageRouteParamsDto = createZodDto(messageRouteParamsSchema);
const ConversationRouteParamsDto = createZodDto(messageRouteParamsSchema.pick({ conversationId: true }));
const ReactionRouteParamsDto = createZodDto(reactionRouteParamsSchema);
const SendMessageDto = createZodDto(sendMessageSchema);
const EditMessageDto = createZodDto(editMessageSchema);
const UpdateReadStateDto = createZodDto(updateReadStateSchema);

@Controller('messaging/conversations/:conversationId')
@UseGuards(UserActorGuard)
export class MessagesController {
  public constructor(
    @Inject(MessageCommandsService)
    private readonly messageCommandsService: MessageCommandsService,
    @Inject(MessageQueriesService)
    private readonly messageQueriesService: MessageQueriesService,
  ) {}

  @Delete('messages/:messageId')
  @UseResponseEnvelope()
  public async deleteMessage(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(MessageRouteParamsDto)) params: MessageRouteParams,
  ) {
    return this.messageCommandsService.deleteMessage(
      actor.id,
      params.conversationId,
      params.messageId,
    );
  }

  @Patch('messages/:messageId')
  @UseResponseEnvelope()
  public async editMessage(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(MessageRouteParamsDto)) params: MessageRouteParams,
    @Body(new ZodValidationPipe(EditMessageDto)) input: EditMessageInput,
  ) {
    return this.messageCommandsService.editMessage(
      actor.id,
      params.conversationId,
      params.messageId,
      input,
    );
  }

  @Get('messages')
  @UseResponseEnvelope()
  public async listMessages(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ConversationRouteParamsDto))
    params: Pick<MessageRouteParams, 'conversationId'>,
    @Query(new ZodValidationPipe(MessageHistoryQueryDto)) query: MessageHistoryQuery,
  ) {
    return this.messageQueriesService.listConversationMessages(
      actor.id,
      params.conversationId,
      query,
    );
  }

  @Post('messages')
  @UseResponseEnvelope()
  public async sendMessage(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ConversationRouteParamsDto))
    params: Pick<MessageRouteParams, 'conversationId'>,
    @Body(new ZodValidationPipe(SendMessageDto)) input: SendMessageInput,
  ) {
    return this.messageCommandsService.sendMessage(actor.id, params.conversationId, input);
  }

  @Delete('messages/:messageId/reactions/:reaction')
  @UseResponseEnvelope()
  public async removeReaction(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ReactionRouteParamsDto)) params: ReactionRouteParams,
  ) {
    return this.messageCommandsService.removeReaction(
      actor.id,
      params.conversationId,
      params.messageId,
      params.reaction,
    );
  }

  @Put('messages/:messageId/reactions/:reaction')
  @UseResponseEnvelope()
  public async upsertReaction(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ReactionRouteParamsDto)) params: ReactionRouteParams,
  ) {
    return this.messageCommandsService.upsertReaction(
      actor.id,
      params.conversationId,
      params.messageId,
      params.reaction,
    );
  }

  @Put('read-state')
  @UseResponseEnvelope()
  public async updateReadState(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(ConversationRouteParamsDto))
    params: Pick<MessageRouteParams, 'conversationId'>,
    @Body(new ZodValidationPipe(UpdateReadStateDto)) input: UpdateReadStateInput,
  ) {
    return this.messageCommandsService.updateReadState(actor.id, params.conversationId, input);
  }
}
