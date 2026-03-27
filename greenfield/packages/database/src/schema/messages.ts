import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';

import { conversationsTable } from './conversations';
import { usersTable } from './users';

export const messageKindEnum = pgEnum('message_kind', ['system', 'user']);
export const messageStatusEnum = pgEnum('message_status', ['active', 'edited', 'deleted']);

export const messagesTable = pgTable(
  'messages',
  {
    authorUserId: uuid('author_user_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    body: text('body'),
    clientRequestId: uuid('client_request_id'),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    id: uuid('id').defaultRandom().primaryKey(),
    kind: messageKindEnum('kind').notNull().default('user'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    replyToMessageId: uuid('reply_to_message_id'),
    sequence: integer('sequence').notNull(),
    status: messageStatusEnum('status').notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authorIndex: index('messages_author_idx').on(table.authorUserId),
    clientRequestUniqueIndex: uniqueIndex('messages_client_request_uidx').on(
      table.conversationId,
      table.authorUserId,
      table.clientRequestId,
    ),
    conversationCreatedAtIndex: index('messages_conversation_created_at_idx').on(
      table.conversationId,
      table.createdAt,
    ),
    conversationSequenceUniqueIndex: uniqueIndex('messages_conversation_sequence_uidx').on(
      table.conversationId,
      table.sequence,
    ),
    replyIndex: index('messages_reply_idx').on(table.replyToMessageId),
    statusIndex: index('messages_status_idx').on(table.status),
  }),
);
