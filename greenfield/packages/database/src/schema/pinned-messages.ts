import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { conversationsTable } from './conversations';
import { messagesTable } from './messages';
import { usersTable } from './users';

export const pinnedMessagesTable = pgTable(
  'pinned_messages',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
      }),
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messagesTable.id, {
        onDelete: 'cascade',
      }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }).defaultNow().notNull(),
    pinnedByUserId: uuid('pinned_by_user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    conversationIndex: index('pinned_messages_conversation_idx').on(table.conversationId),
    messageUniqueIndex: uniqueIndex('pinned_messages_conversation_message_uidx').on(
      table.conversationId,
      table.messageId,
    ),
  }),
);
