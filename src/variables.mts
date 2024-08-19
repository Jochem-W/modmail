/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import camelcaseKeys from "camelcase-keys"
import { z } from "zod"

const model = z
  .object({
    DISCORD_BOT_TOKEN: z.string(),
    DATABASE_URL: z.string(),
  })
  .transform((arg) => camelcaseKeys(arg))

export const Variables = await model.parseAsync(process.env)
