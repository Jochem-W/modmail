/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { threadsTable } from "../schema.mjs"
import { fetchChannel } from "../utilities/discord.mjs"
import { enqueue, startQueue } from "../utilities/thread.mjs"
import { ChannelType } from "discord.js"
import { eq } from "drizzle-orm"

export const RestoreHandler = handler({
  event: "ready",
  once: true,
  async handle(client) {
    const threads = await Drizzle.select()
      .from(threadsTable)
      .where(eq(threadsTable.open, true))

    for (const thread of threads) {
      const threadChannel = await fetchChannel(
        client,
        thread.id,
        ChannelType.PublicThread,
      )

      let messages
      let after = thread.last
      do {
        messages = await threadChannel.messages.fetch({
          after,
          limit: 100,
        })
        after = messages.firstKey() ?? after

        enqueue(...messages.values())
      } while (messages.size === 100)

      const user = await client.users.fetch(thread.user)
      const dmChannel = user.dmChannel ?? (await user.createDM())

      after = thread.last
      do {
        messages = await dmChannel.messages.fetch({
          after,
          limit: 100,
        })
        after = messages.firstKey() ?? after

        enqueue(...messages.values())
      } while (messages.size === 100)
    }

    startQueue()
  },
})
