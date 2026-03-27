import { index, pgTable, timestamp, uniqueIndex, uuid, text } from 'drizzle-orm/pg-core';

import { messagesTable } from './messages';
import { usersTable } from './users';

export const messageReactionsTable = pgTable(
  'message_reactions',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messagesTable.id, {
        onDelete: 'cascade',
      }),
    reaction: text('reaction').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    messageIndex: index('message_reactions_message_idx').on(table.messageId),
    reactionUniqueIndex: uniqueIndex('message_reactions_message_user_reaction_uidx').on(
      table.messageId,
      table.userId,
      table.reaction,
    ),
    userIndex: index('message_reactions_user_idx').on(table.userId),
  }),
);
