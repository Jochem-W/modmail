/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import {
  User,
  type Channel,
  type FetchChannelOptions,
  type GuildMember,
  type PublicThreadChannel,
  type Snowflake,
} from "discord.js"
import {
  ChannelType,
  DiscordAPIError,
  RESTJSONErrorCodes,
  Guild,
} from "discord.js"
import type { Client, FetchMemberOptions, UserResolvable } from "discord.js"
import { DateTime } from "luxon"

export function uniqueName(user: User) {
  if (user.discriminator !== "0") {
    return `${user.username}#${user.discriminator}`
  }

  return user.username
}

export function userDisplayName(user: User) {
  if (user.globalName) {
    return user.globalName
  }

  return user.username
}

export function memberDisplayName(member: GuildMember) {
  if (member.nickname) {
    return member.nickname
  }

  return userDisplayName(member.user)
}

export function snowflakeToDateTime(snowflake: Snowflake) {
  return DateTime.fromMillis(
    Number((BigInt(snowflake) >> 22n) + 1420070400000n),
    { zone: "utc" },
  )
}

export async function tryFetchMember(
  data: { id: Snowflake; client: Client<true> } | Guild,
  options: FetchMemberOptions | UserResolvable,
) {
  let guild
  if (!(data instanceof Guild)) {
    const { id, client } = data
    guild = await client.guilds.fetch(id)
  } else {
    guild = data
  }

  try {
    return await guild.members.fetch(options)
  } catch (e) {
    if (
      e instanceof DiscordAPIError &&
      e.code === RESTJSONErrorCodes.UnknownMember
    ) {
      return null
    }

    throw e
  }
}

export async function fetchChannel<T extends ChannelType>(
  client: Client<true>,
  id: Snowflake,
  type: T | T[],
  options?: FetchChannelOptions,
) {
  const channel = await client.channels.fetch(id, options)
  if (!channel) {
    throw new Error(`Couldn't find a channel with ID ${id}`)
  }

  if (
    (typeof type === "number" && channel.type !== type) ||
    (typeof type === "object" && !type.includes(channel.type as T))
  )
    if (channel.type !== type) {
      throw new Error(
        `Channel ${id} is of type ${channel.type} (expected ${type.toString()})`,
      )
    }

  return channel as T extends
    | ChannelType.PublicThread
    | ChannelType.AnnouncementThread
    ? PublicThreadChannel
    : Extract<Channel, { type: T }>
}
