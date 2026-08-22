/**
 * Development only. Clears every table and re-runs the seeds so the browser
 * tests start from a known state.
 *
 * Clears rows rather than deleting the database file: a running dev server
 * holds an open handle, and replacing the file out from under it leaves the
 * server talking to a deleted inode.
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "file:./local.db";
if (!url.startsWith("file:")) {
  console.error(`Refusing to reset a non-local database: ${url}`);
  process.exit(1);
}

async function main() {
  const client = createClient({ url });

  const tables = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name != '__drizzle_migrations'",
  );

  await client.execute("PRAGMA foreign_keys = OFF");
  for (const row of tables.rows) {
    await client.execute(`DELETE FROM "${row.name as string}"`);
  }
  await client.execute("PRAGMA foreign_keys = ON");
  client.close();

  const run = (script: string) => execFileSync("npx", ["tsx", script], { stdio: "inherit", env: process.env });
  run("lib/db/migrate.ts");
  run("lib/db/seed.ts");
  run("lib/db/seed-responses.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
