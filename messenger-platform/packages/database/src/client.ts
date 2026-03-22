import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/conversations";
import * as messageSchema from "./schema/messages";
import * as uploadSchema from "./schema/uploads";
import * as userSchema from "./schema/users";

export const createDatabase = (connectionString = process.env.DATABASE_URL) => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize PostgreSQL.");
  }

  const client = postgres(connectionString, {
    max: 10
  });

  return drizzle(client, {
    schema: {
      ...schema,
      ...messageSchema,
      ...uploadSchema,
      ...userSchema
    }
  });
};

