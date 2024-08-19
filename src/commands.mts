/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { BlockCommand } from "./commands/block.mjs"
import { BotCommand } from "./commands/bot.mjs"
import { ThreadCommand } from "./commands/thread.mjs"
import type { Command } from "./models/command.mjs"
import { Collection } from "discord.js"
import type { ApplicationCommandType, Snowflake } from "discord.js"

export const SlashCommands: Command<ApplicationCommandType.ChatInput>[] = [
  BotCommand,
  BlockCommand,
  ThreadCommand,
]

export const MessageContextMenuCommands: Command<ApplicationCommandType.Message>[] =
  []

export const UserContextMenuCommands: Command<ApplicationCommandType.User>[] =
  []

export const RegisteredCommands = new Collection<
  Snowflake,
  Command<ApplicationCommandType>
>()
