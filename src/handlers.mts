/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { InteractionHandler } from "./handlers/interactionCreate.mjs"
import { MessageCreateHandler } from "./handlers/messageCreate.mjs"
import { RestoreHandler } from "./handlers/restore.mjs"
import { SetupHandler } from "./handlers/setup.mjs"
import { StartupHandler } from "./handlers/startup.mjs"
import { TypingHandler } from "./handlers/typing.mjs"
import type { Handler } from "./models/handler.mjs"
import type { ClientEvents } from "discord.js"

export const Handlers: Handler<keyof ClientEvents>[] = [
  InteractionHandler,
  StartupHandler,
  MessageCreateHandler,
  RestoreHandler,
  TypingHandler,
  SetupHandler,
]
