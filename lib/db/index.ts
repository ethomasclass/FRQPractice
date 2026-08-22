import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite everywhere: a local file in development, Turso in production. Same
 * dialect both places, so what passes locally is what runs for students.
 */
const url = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __frqClient?: ReturnType<typeof createClient> };
const client = globalForDb.__frqClient ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__frqClient = client;

export const db = drizzle(client, { schema });
export { schema };
