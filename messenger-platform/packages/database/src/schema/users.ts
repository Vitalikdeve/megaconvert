import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 32 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  identityPublicKey: text("identity_public_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const devices = pgTable("devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  signedPreKey: text("signed_pre_key").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

