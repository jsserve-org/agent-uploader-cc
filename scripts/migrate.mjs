// Plain-Node migrator used by the container entrypoint. Kept dependency-light
// (only drizzle-orm + postgres, both already shipped in the runtime image) so
// it runs under `node` without tsx/esbuild.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await client.end();
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err);
  await client.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
