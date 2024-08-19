/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Db } from "../clients.mjs"
import { logError } from "../errors.mjs"
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { fetchChannel } from "../utilities/discord.mjs"
import { ChannelType, Client, EmbedBuilder } from "discord.js"
import { readFile, writeFile } from "fs/promises"

type State = "UP" | "DOWN" | "RECREATE"

export const StartupHandler = handler({
  event: "ready",
  once: true,
  async handle(client) {
    console.log(`Running as: ${client.user.globalName ?? client.user.username}`)

    let title = "Bot "
    switch (await getState()) {
      case "UP":
        title += "crashed"
        break
      case "DOWN":
        title += "restarted"
        break
      case "RECREATE":
        title += "redeployed"
        break
      default:
        title += "unknown"
        break
    }

    if (Config.logs) {
      const message = {
        embeds: [new EmbedBuilder().setTitle(title)],
      }
      const channel = await fetchChannel(
        client,
        Config.logs,
        ChannelType.GuildText,
      )
      await channel.send(message)
    }

    await setState("UP")

    process.on("SIGINT", () => exitListener(client))
    process.on("SIGTERM", () => exitListener(client))

    for (const guild of client.guilds.cache.values()) {
      await guild.members.fetch()
    }
  },
})

function exitListener(client: Client<true>) {
  client
    .destroy()
    .then(() => Db.end())
    .then(() => setState("DOWN"))
    .then(() => process.exit())
    .catch((e) => {
      void (e instanceof Error ? logError(client, e) : console.error(e))
    })
}

type ArbitraryObject = Record<string, unknown>

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    isArbitraryObject(error) &&
    error instanceof Error &&
    (typeof error["errno"] === "number" ||
      typeof error["errno"] === "undefined") &&
    (typeof error["code"] === "string" ||
      typeof error["code"] === "undefined") &&
    (typeof error["path"] === "string" ||
      typeof error["path"] === "undefined") &&
    (typeof error["syscall"] === "string" ||
      typeof error["syscall"] === "undefined")
  )
}

function isArbitraryObject(
  potentialObject: unknown,
): potentialObject is ArbitraryObject {
  return typeof potentialObject === "object" && potentialObject !== null
}

async function setState(status: State) {
  await writeFile("status", status, { encoding: "utf8" })
}

async function getState() {
  try {
    const state = await readFile("status", "utf8")
    if (state !== "UP" && state !== "DOWN" && state !== "RECREATE") {
      return "RECREATE"
    }

    return state
  } catch (e) {
    if (!isErrnoException(e) || e.code !== "ENOENT") {
      throw e
    }

    return "RECREATE"
  }
}
