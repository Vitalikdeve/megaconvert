import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 16 }).notNull(),
  title: varchar("title", { length: 160 }),
  senderKeyCiphertext: text("sender_key_ciphertext"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const conversationMembers = pgTable("conversation_members", {
  conversationId: uuid("conversation_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 24 }).default("member").notNull(),
  unreadCount: integer("unread_count").default(0).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull()
});

