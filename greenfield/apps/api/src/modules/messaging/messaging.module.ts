import { Module } from '@nestjs/common';

import { AuditShellModule } from '../audit-shell/audit-shell.module';
import { DatabaseModule } from '../database/database.module';
import { RealtimeShellModule } from '../realtime-shell/realtime-shell.module';

import { ConversationCommandsService } from './application/conversation-commands.service';
import { ConversationQueriesService } from './application/conversation-queries.service';
import { MessageCommandsService } from './application/message-commands.service';
import { MessageQueriesService } from './application/message-queries.service';
import { MessagingRealtimeService } from './application/messaging-realtime.service';
import { PostgresMessagingRepository } from './infrastructure/postgres-messaging.repository';
import { ConversationsController } from './interfaces/http/conversations.controller';
import { MessagesController } from './interfaces/http/messages.controller';
import { MESSAGING_REPOSITORY } from './messaging.constants';

@Module({
  controllers: [ConversationsController, MessagesController],
  imports: [AuditShellModule, DatabaseModule, RealtimeShellModule],
  providers: [
    ConversationCommandsService,
    ConversationQueriesService,
    MessageCommandsService,
    MessageQueriesService,
    MessagingRealtimeService,
    {
      provide: MESSAGING_REPOSITORY,
      useClass: PostgresMessagingRepository,
    },
  ],
})
export class MessagingModule {}
