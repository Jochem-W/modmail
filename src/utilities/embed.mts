/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { codeBlock, EmbedBuilder } from "discord.js"

export function makeErrorMessage(error: Error) {
  if (error.stack) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle("An unexpected error has occurred")
          .setDescription(codeBlock(error.stack))
          .setColor("#ff0000"),
      ],
    }
  }

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(error.constructor.name)
        .setDescription(error.message)
        .setColor("#ff0000"),
    ],
  }
}

export function embedsLength(embeds: EmbedBuilder[]) {
  let length = 0
  for (const embed of embeds) {
    if (embed.data.title) {
      length += embed.data.title.length
    }

    if (embed.data.description) {
      length += embed.data.description.length
    }

    if (embed.data.fields) {
      for (const { name, value } of embed.data.fields) {
        length += name.length + value.length
      }
    }

    if (embed.data.footer?.text) {
      length += embed.data.footer.text.length
    }

    if (embed.data.author?.name) {
      length += embed.data.author.name.length
    }
  }

  return length
}
