import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  senderUserId: uuid("sender_user_id").notNull(),
  senderDeviceId: uuid("sender_device_id").notNull(),
  ciphertext: text("ciphertext").notNull(),
  signature: text("signature").notNull(),
  sessionId: varchar("session_id", { length: 120 }).notNull(),
  ratchetCounter: integer("ratchet_counter").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true })
});

export const messageReactions = pgTable("message_reactions", {
  messageId: uuid("message_id").notNull(),
  userId: uuid("user_id").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

