import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const tables = sqliteTable("blackjack_tables", {
  id: text("id").primaryKey(),
  playerHash: text("player_hash").notNull().unique(),
  dealerHash: text("dealer_hash").notNull().unique(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  botSeen: integer("bot_seen"),
  createdAt: integer("created_at").notNull(),
});
