/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Config } from "./models/config.mjs"
import { fetchChannel } from "./utilities/discord.mjs"
import { makeErrorMessage } from "./utilities/embed.mjs"
import { ChannelType } from "discord.js"
import type { Client } from "discord.js"

export async function logError(client: Client, error: unknown) {
  console.error(error)
  if (!client.isReady() || !(error instanceof Error)) {
    return
  }

  const channel = await fetchChannel(client, Config.logs, ChannelType.GuildText)
  await channel.send(makeErrorMessage(error))
}
