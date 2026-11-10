import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "The local D1 binding `DB` is unavailable. Start the app with Start Guild Manager.cmd so the local database is configured."
    );
  }

  return drizzle(env.DB, { schema });
}
