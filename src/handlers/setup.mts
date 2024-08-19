/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Config } from "../models/config.mjs"
import { handler } from "../models/handler.mjs"
import { fetchChannel } from "../utilities/discord.mjs"
import {
  ChannelType,
  ForumLayoutType,
  SortOrderType,
  ThreadAutoArchiveDuration,
} from "discord.js"

type Key = "awaitingStaff" | "awaitingUser" | "closed" | "open"

export const Tags: {
  [K in Key]: {
    id: string | null
    name: string
    emoji: { name: string; id: null }
  }
} = {
  awaitingStaff: {
    id: null,
    name: "Awaiting staff reply",
    emoji: { name: "⏱️", id: null },
  },
  awaitingUser: {
    id: null,
    name: "Awaiting user reply",
    emoji: { name: "⏱️", id: null },
  },
  closed: {
    id: null,
    name: "Closed",
    emoji: { name: "🔒", id: null },
  },
  open: {
    id: null,
    name: "Open",
    emoji: { name: "🔓", id: null },
  },
}

export const SetupHandler = handler({
  event: "ready",
  once: true,
  async handle(client) {
    const channel = await fetchChannel(
      client,
      Config.forum,
      ChannelType.GuildForum,
    )

    const add = []
    for (const tag of Object.values(Tags)) {
      if (
        !channel.availableTags.some(
          (t) => t.name === tag.name && t.emoji?.name === tag.emoji.name,
        )
      ) {
        add.push({ name: tag.name, emoji: tag.emoji })
      }
    }

    await channel.edit({
      availableTags: [...channel.availableTags, ...add],
      defaultAutoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      defaultSortOrder: SortOrderType.LatestActivity,
      defaultForumLayout: ForumLayoutType.ListView,
    })

    for (const tag of Object.values(Tags)) {
      const forumTag = channel.availableTags.find(
        (t) => t.name === tag.name && t.emoji?.name === tag.emoji.name,
      )
      if (forumTag) {
        tag.id = forumTag.id
      }
    }
  },
})
