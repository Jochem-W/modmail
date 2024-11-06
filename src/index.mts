/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  MessageContextMenuCommands,
  RegisteredCommands,
  SlashCommands,
  UserContextMenuCommands,
} from "./commands.mjs"
import { logError } from "./errors.mjs"
import { Handlers } from "./handlers.mjs"
import type { Command } from "./models/command.mjs"
import { Config } from "./models/config.mjs"
import { Handler } from "./models/handler.mjs"
import { Variables } from "./variables.mjs"
import {
  ApplicationCommandType,
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
} from "discord.js"
import type {
  RESTPutAPIApplicationCommandsResult,
  RESTPutAPIApplicationCommandsJSONBody,
  ClientEvents,
} from "discord.js"

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildScheduledEvent,
    Partials.ThreadMember,
  ],
})
discord.rest.setToken(Variables.discordBotToken)

const commandsBody: RESTPutAPIApplicationCommandsJSONBody = []
for (const command of [
  ...SlashCommands,
  ...MessageContextMenuCommands,
  ...UserContextMenuCommands,
]) {
  commandsBody.push(command.builder.toJSON())
  console.log(`Constructed command '${command.builder.name}'`)
}

const applicationCommands = (await discord.rest.put(
  Routes.applicationCommands(Config.applicationId),
  {
    body: commandsBody,
  },
)) as RESTPutAPIApplicationCommandsResult
console.log("Commands updated")
for (const applicationCommand of applicationCommands) {
  let command: Command<ApplicationCommandType> | undefined
  switch (applicationCommand.type) {
    case ApplicationCommandType.ChatInput:
      command = SlashCommands.find(
        (c) => c.builder.name === applicationCommand.name,
      )
      break
    case ApplicationCommandType.User:
      command = UserContextMenuCommands.find(
        (c) => c.builder.name === applicationCommand.name,
      )
      break
    case ApplicationCommandType.Message:
      command = MessageContextMenuCommands.find(
        (c) => c.builder.name === applicationCommand.name,
      )
      break
    default:
      break
  }

  if (!command) {
    throw new Error(
      `Couldn't find a command with name ${applicationCommand.name}`,
    )
  }

  RegisteredCommands.set(applicationCommand.id, command)
}

async function listener<T extends keyof ClientEvents>(
  handler: Handler<T>,
  ...args: ClientEvents[T]
) {
  try {
    await handler.handle(...args)
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e
    }

    await logError(discord, e)
  }
}

for (const handler of Handlers) {
  if (handler.once) {
    discord.once(handler.event, (...args) => void listener(handler, ...args))
    continue
  }

  discord.on(handler.event, (...args) => void listener(handler, ...args))
}

await discord.login(Variables.discordBotToken)
