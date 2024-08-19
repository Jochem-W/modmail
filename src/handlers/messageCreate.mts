/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { handler } from "../models/handler.mjs"
import { enqueue } from "../utilities/thread.mjs"

export const MessageCreateHandler = handler({
  event: "messageCreate",
  once: false,
  handle(message) {
    enqueue(message)
  },
})
