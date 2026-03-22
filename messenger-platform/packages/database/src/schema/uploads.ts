import {
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  encryptedKeyEnvelope: text("encrypted_key_envelope"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const uploadParts = pgTable("upload_parts", {
  uploadId: uuid("upload_id").notNull(),
  partNumber: integer("part_number").notNull(),
  eTag: varchar("etag", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

