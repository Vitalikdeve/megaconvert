import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { conversationsTable } from './conversations';
import { messagesTable } from './messages';
import { usersTable } from './users';

export const conversationDraftsTable = pgTable(
  'conversation_drafts',
  {
    body: text('body').notNull().default(''),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
      }),
    id: uuid('id').defaultRandom().primaryKey(),
    replyToMessageId: uuid('reply_to_message_id').references(() => messagesTable.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    conversationIndex: index('conversation_drafts_conversation_idx').on(table.conversationId),
    userConversationUniqueIndex: uniqueIndex('conversation_drafts_user_conversation_uidx').on(
      table.userId,
      table.conversationId,
    ),
  }),
);
