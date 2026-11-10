import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guildState = sqliteTable("guild_state", {
  id: integer("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
