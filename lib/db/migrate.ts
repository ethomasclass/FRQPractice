import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Applies any pending migrations. Runs as part of the production build, so a
 * deploy brings the database up to date on its own and nobody has to open a
 * terminal to launch this or to ship a schema change later.
 *
 * Already-applied migrations are skipped, so running it repeatedly is safe.
 */
async function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // Vercel builds preview/production with env vars present. If they are
    // missing the app cannot work at all, so fail here rather than deploying
    // something that throws on its first query.
    throw new Error(
      "DATABASE_URL is not set. Add it (and DATABASE_AUTH_TOKEN for Turso) to the project's environment variables.",
    );
  }

  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(`Migrations applied to ${url.replace(/\/\/.*@/, "//")}.`);
  client.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
