import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { conversationsTable } from './conversations';
import { messagesTable } from './messages';
import { usersTable } from './users';

export const conversationMemberRoleEnum = pgEnum('conversation_member_role', [
  'owner',
  'admin',
  'member',
]);

export const conversationMembershipsTable = pgTable(
  'conversation_memberships',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
      }),
    id: uuid('id').defaultRandom().primaryKey(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    lastReadMessageId: uuid('last_read_message_id').references(() => messagesTable.id, {
      onDelete: 'set null',
    }),
    lastReadSequence: integer('last_read_sequence').notNull().default(0),
    role: conversationMemberRoleEnum('role').notNull().default('member'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    conversationIndex: index('conversation_memberships_conversation_idx').on(table.conversationId),
    readSequenceIndex: index('conversation_memberships_read_sequence_idx').on(
      table.conversationId,
      table.lastReadSequence,
    ),
    userConversationUniqueIndex: uniqueIndex('conversation_memberships_user_conversation_uidx').on(
      table.userId,
      table.conversationId,
    ),
    userIndex: index('conversation_memberships_user_idx').on(table.userId),
  }),
);
