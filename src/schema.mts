/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { boolean, pgTable, text, unique } from "drizzle-orm/pg-core"

export const threadsTable = pgTable(
  "thread",
  {
    id: text("id").primaryKey(),
    user: text("user").notNull(),
    open: boolean("open"),
    last: text("last").notNull(),
    lastClose: text("last_close"),
  },
  (t) => [unique().on(t.user, t.open)],
)

export const pingsTable = pgTable("ping", { id: text("id").primaryKey() })

export const blocksTable = pgTable("block", { id: text("id").primaryKey() })
