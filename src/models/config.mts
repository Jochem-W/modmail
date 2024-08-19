/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { readFile } from "fs/promises"
import { z } from "zod"

const model = z.object({
  applicationId: z.string(),
  guild: z.string(),
  forum: z.string(),
  logs: z.string(),
  prefixes: z.array(z.string()),
  commands: z.array(z.string()),
})

export const Config = await model.parseAsync(
  JSON.parse(await readFile("config.json", "utf-8")),
)
