/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { handler } from "../models/handler.mjs"
import { threadsTable } from "../schema.mjs"
import { fetchChannel } from "../utilities/discord.mjs"
import { ChannelType } from "discord.js"
import { and, eq } from "drizzle-orm"

export const TypingHandler = handler({
  event: "typingStart",
  once: false,
  async handle(typing) {
    if (
      !typing.channel.isDMBased() ||
      typing.channel.type === ChannelType.GroupDM
    ) {
      return
    }

    const [thread] = await Drizzle.select()
      .from(threadsTable)
      .where(
        and(
          eq(threadsTable.user, typing.channel.recipientId),
          eq(threadsTable.open, true),
        ),
      )

    if (!thread) {
      return
    }

    const channel = await fetchChannel(
      typing.client,
      thread.id,
      ChannelType.PublicThread,
    )
    await channel.sendTyping()
  },
})
