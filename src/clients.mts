/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Variables } from "./variables.mjs"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

export const Db = postgres(Variables.databaseUrl)
export const Drizzle = drizzle(Db)

await migrate(Drizzle, { migrationsFolder: "./drizzle" })
