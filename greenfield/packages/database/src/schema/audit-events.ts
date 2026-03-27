import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditEventsTable = pgTable(
  'audit_events',
  {
    action: text('action').notNull(),
    actorId: text('actor_id'),
    actorType: text('actor_type'),
    category: text('category').notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    requestId: text('request_id'),
    targetId: text('target_id'),
    targetType: text('target_type'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    actionIndex: index('audit_events_action_idx').on(table.action),
    actorIndex: index('audit_events_actor_idx').on(table.actorType, table.actorId),
    categoryIndex: index('audit_events_category_idx').on(table.category),
    occurredAtIndex: index('audit_events_occurred_at_idx').on(table.occurredAt),
    requestIndex: index('audit_events_request_idx').on(table.requestId),
    targetIndex: index('audit_events_target_idx').on(table.targetType, table.targetId),
  }),
);
