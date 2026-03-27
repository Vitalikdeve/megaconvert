import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { conversationsTable } from './conversations';
import { usersTable } from './users';

export const directConversationsTable = pgTable(
  'direct_conversations',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
      }),
    id: uuid('id').defaultRandom().primaryKey(),
    participantOneUserId: uuid('participant_one_user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
    participantTwoUserId: uuid('participant_two_user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    conversationUniqueIndex: uniqueIndex('direct_conversations_conversation_uidx').on(table.conversationId),
    participantOneIndex: index('direct_conversations_participant_one_idx').on(table.participantOneUserId),
    participantPairUniqueIndex: uniqueIndex('direct_conversations_participant_pair_uidx').on(
      table.participantOneUserId,
      table.participantTwoUserId,
    ),
    participantTwoIndex: index('direct_conversations_participant_two_idx').on(table.participantTwoUserId),
  }),
);
