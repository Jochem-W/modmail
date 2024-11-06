/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { Colours } from "../colours.mjs"
import { logError } from "../errors.mjs"
import { Tags } from "../handlers/setup.mjs"
import { component } from "../models/component.mjs"
import { Config } from "../models/config.mjs"
import { blocksTable, pingsTable, threadsTable } from "../schema.mjs"
import { fetchChannel } from "./discord.mjs"
import {
  ActionRowBuilder,
  AttachmentBuilder,
  bold,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  channelMention,
  ChannelType,
  Client,
  ComponentType,
  DiscordAPIError,
  EmbedBuilder,
  EmbedFooterOptions,
  Guild,
  inlineCode,
  italic,
  Message,
  MessageActionRowComponentBuilder,
  MessageCreateOptions,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  userMention,
} from "discord.js"
import { and, desc, eq } from "drizzle-orm"
import { DateTime } from "luxon"
import PQueue from "p-queue"
import postgres from "postgres"
import { Stream } from "stream"
import { MIMEType } from "util"

const queue = new PQueue({ concurrency: 1, autoStart: false })
const lastConfirmation = new Map<string, Message>()
const fullCommands = new Set(
  Config.prefixes.flatMap((prefix) =>
    Config.commands.map((command) => `${prefix}${command}`),
  ),
)

export function startQueue() {
  queue.start()
}

export function enqueue(...messages: Message[]) {
  for (const message of messages) {
    queue
      .add(() => processMessage(message), {
        priority: -message.createdTimestamp,
      })
      .catch((e) => logError(message.client, e))
  }
}

async function processMessage(message: Message) {
  if (message.author.bot) {
    return
  }

  if (!message.content && message.attachments.size === 0) {
    return
  }

  if (message.inGuild()) {
    await processGuildMessage(message)
    return
  }

  await processDmMessage(message)
}

function getShortMessage(message: Message) {
  return message.content.length > 128
    ? `${message.content.substring(127)}…`
    : message.content ||
        `[${message.attachments.size} ${message.attachments.size === 1 ? "attachment" : "attachments"}]`
}

async function processGuildMessage(message: Message<true>) {
  let send = false
  for (const command of fullCommands) {
    if (message.content === command) {
      message.content = ""
      send = true
      break
    }

    if (message.content.startsWith(`${command} `)) {
      message.content = message.content.substring(command.length + 1)
      send = true
      break
    }
  }

  if (!send) {
    return
  }

  if (
    message.channel.type !== ChannelType.PublicThread ||
    message.channel.parentId !== Config.forum
  ) {
    return
  }

  const [thread] = await Drizzle.select()
    .from(threadsTable)
    .where(eq(threadsTable.id, message.channel.id))

  if (!thread) {
    return
  }

  if (!thread.open) {
    return
  }

  if (thread.lastClose) {
    await message.channel.messages.edit(thread.lastClose, { components: [] })
  }

  let sent = false
  let sendResponse
  try {
    const user = await message.client.users.fetch(thread.user)
    await user.send(
      await formatMessage(
        message,
        "received",
        await generateFooter(message.guild),
      ),
    )
    sendResponse = await formatMessage(message, "sent")
    sent = true
  } catch (e) {
    if (!(e instanceof DiscordAPIError)) {
      throw e
    }

    if (e.code === RESTJSONErrorCodes.UnknownUser) {
      sendResponse = {
        reply: { messageReference: message.id },
        embeds: [
          new EmbedBuilder()
            .setTitle("Couldn't send message")
            .setDescription(
              "The message could not be sent to the member because their account no longer exists.",
            )
            .setColor(Colours.red[500]),
        ],
      }
    } else if (e.code == RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
      sendResponse = {
        reply: { messageReference: message.id },
        embeds: [
          new EmbedBuilder()
            .setTitle("Couldn't send message")
            .setDescription(
              "The message could not be sent to the member because they are no longer in the server, have disabled their DMs, or have blocked the bot.",
            )
            .setColor(Colours.red[500]),
        ],
      }
    } else {
      sendResponse = {
        reply: { messageReference: message.id },
        embeds: [
          new EmbedBuilder()
            .setTitle("Couldn't send message")
            .setDescription(
              `The message could not be sent to the member because of an unknown reason (${e.name}).`,
            )
            .setColor(Colours.red[500]),
        ],
      }
    }
  }

  const close = await message.channel.send(addCloseButton(sendResponse))

  if (sent) {
    await message.channel.messages.edit(thread.id, {
      content: `📤 ${bold(message.author.displayName)}: ${getShortMessage(message)}`,
    })

    await message.delete()

    await message.channel.edit({
      appliedTags: [Tags.open.id, Tags.awaitingUser.id].filter(
        (t) => t !== null,
      ),
    })
  }

  await Drizzle.update(threadsTable)
    .set({ last: message.id, lastClose: close.id })
    .where(eq(threadsTable.id, thread.id))
}

async function processDmMessage(message: Message) {
  const [thread] = await Drizzle.select()
    .from(threadsTable)
    .where(
      and(
        eq(threadsTable.open, true),
        eq(threadsTable.user, message.author.id),
      ),
    )

  const footer = await generateFooter(message.client)

  if (!thread) {
    await lastConfirmation.get(message.author.id)?.delete()

    lastConfirmation.set(
      message.author.id,
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Create thread")
            .setDescription(
              "You currently don't have an active thread. Would you like to create a new thread using your messages above?",
            )
            .setColor(Colours.blue[500])
            .setFooter(footer),
        ],
        components: [
          new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
            new ButtonBuilder()
              .setCustomId(createThreadButton())
              .setLabel("Create thread")
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      }),
    )
    return
  }

  const channel = await fetchChannel(
    message.client,
    thread.id,
    ChannelType.PublicThread,
  )

  if (thread.lastClose) {
    await channel.messages.edit(thread.lastClose, { components: [] })
  }

  const close = await channel.send(
    addCloseButton(await formatMessage(message, "received")),
  )

  try {
    await message.author.send(await formatMessage(message, "sent", footer))
  } catch (e) {
    if (
      !(e instanceof DiscordAPIError) ||
      e.code !== RESTJSONErrorCodes.CannotSendMessagesToThisUser
    ) {
      throw e
    }
  }

  await channel.messages.edit(thread.id, {
    content: `📥 ${bold(message.author.displayName)}: ${getShortMessage(message)}`,
  })

  await Drizzle.update(threadsTable)
    .set({ last: message.id, lastClose: close.id })
    .where(eq(threadsTable.id, thread.id))

  await channel.edit({
    appliedTags: [Tags.open.id, Tags.awaitingStaff.id].filter(
      (t) => t !== null,
    ),
  })
}

async function attachmentsToMessage(message: Message) {
  const embeds = []
  for (const attachment of message.attachments.values()) {
    if (!attachment.contentType) {
      continue
    }

    const mimeType = new MIMEType(attachment.contentType)
    if (mimeType.type === "image") {
      embeds.push(
        new EmbedBuilder().setImage(
          `attachment://${attachment.id}_${attachment.name}`,
        ),
      )
    }
  }

  return {
    embeds,
    files: (
      await Promise.allSettled(
        message.attachments.map(async (a) => {
          const response = await fetch(a.url)
          if (!response.ok || response.body === null) {
            throw new Error(`Couldn't fetch ${a.url}`)
          }

          return new AttachmentBuilder(
            response.body as unknown as Stream,
          ).setName(`${a.id}_${a.name}`)
        }),
      )
    )
      .filter((p) => p.status === "fulfilled")
      .map((p) => p.value),
  }
}

async function formatMessage(
  message: Message,
  type: "sent" | "received",
  footer?: EmbedFooterOptions,
) {
  const formatted = await attachmentsToMessage(message)
  let mainEmbed = formatted.embeds[0]
  if (!mainEmbed) {
    mainEmbed = new EmbedBuilder()
    formatted.embeds.push(mainEmbed)
  }

  for (const embed of formatted.embeds) {
    embed.setColor(type === "sent" ? Colours.amber[500] : Colours.green[500])
  }

  mainEmbed
    .setDescription(message.content || null)
    .setAuthor({
      name: message.author.displayName,
      iconURL: message.author.displayAvatarURL(),
    })
    .setTitle(type === "sent" ? "Message sent" : "Message received")
    .setTimestamp(message.createdAt)

  if (footer) {
    mainEmbed.setFooter(footer)
  }

  return formatted
}

const createThreadButton = component({
  type: ComponentType.Button,
  name: "create",
  async handle(interaction) {
    if (!interaction.channel?.isDMBased()) {
      return
    }

    const [blocked] = await Drizzle.select()
      .from(blocksTable)
      .where(eq(blocksTable.id, interaction.user.id))

    if (blocked) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Blocked from creating threads")
            .setDescription(
              "A mail thread couldn't be created because you're currently blocked from creating new mail threads.",
            )
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
      })
      return
    }

    const previousThreads = await Drizzle.select()
      .from(threadsTable)
      .where(and(eq(threadsTable.user, interaction.user.id)))
      .orderBy(desc(threadsTable.id))

    const previousThread = previousThreads[0]
    if (previousThread?.open) {
      await threadAlreadyExists(interaction)
      return
    }

    const forum = await fetchChannel(
      interaction.client,
      Config.forum,
      ChannelType.GuildForum,
    )

    let previousThreadsStr = ""
    for (const thread of previousThreads.splice(0, 5)) {
      const formatted = `- ${channelMention(thread.id)}`
      const newStr = `${previousThreadsStr}\n${formatted}`.trimStart()
      if (newStr.length > 1024) {
        break
      }

      previousThreadsStr = newStr
    }

    if (previousThreads.length > 0) {
      previousThreadsStr += `\n- ${italic(`And ${previousThreads.length} more…`)}`
    }

    previousThreadsStr ||= "None"

    const thread = await forum.threads.create({
      appliedTags: [Tags.open.id, Tags.awaitingStaff.id].filter(
        (t) => t !== null,
      ),
      name: `${interaction.user.displayName} (${interaction.user.id})`,
      message: {
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: interaction.user.displayName,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setTitle("New thread")
            .setDescription(
              `Prefix a message with ${[...fullCommands.values()].map((c) => inlineCode(c)).join(", ")} to reply.`,
            )
            .setFields(
              {
                name: "User",
                value: userMention(interaction.user.id),
                inline: true,
              },
              { name: "User ID", value: interaction.user.id, inline: true },
              { name: "Previous threads", value: previousThreadsStr },
            )
            .setColor(Colours.blue[500])
            .setTimestamp(interaction.createdAt),
        ],
      },
    })

    const pinglist = await Drizzle.select().from(pingsTable)
    for (const { id } of pinglist) {
      const member = thread.guild.members.cache.get(id)
      if (!member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await Drizzle.delete(pingsTable).where(eq(pingsTable.id, id))
        continue
      }

      await thread.members.add(member.id)
    }

    try {
      await Drizzle.insert(threadsTable)
        .values({
          user: interaction.user.id,
          id: thread.id,
          last: thread.id,
          open: true,
        })
        .returning()
    } catch (e) {
      await thread.delete()

      if (!(e instanceof postgres.PostgresError) || e.code !== "23505") {
        throw e
      }

      await threadAlreadyExists(interaction)
      return
    }

    await interaction.update(disableComponents(interaction.message))

    try {
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("Thread created")
            .setDescription(
              "Any messages you send here will be automatically sent to staff.",
            )
            .setFooter(await generateFooter(interaction.client))
            .setColor(Colours.blue[500])
            .setTimestamp(thread.createdAt),
        ],
      })
    } catch (e) {
      if (
        !(e instanceof DiscordAPIError) ||
        e.code !== RESTJSONErrorCodes.CannotSendMessagesToThisUser
      ) {
        throw e
      }
    }

    let messages
    if (previousThread) {
      let after = previousThread.last
      do {
        messages = await interaction.channel.messages.fetch({
          limit: 100,
          after,
        })
        after = messages.firstKey() ?? thread.id

        enqueue(
          ...messages
            .filter(
              (message) =>
                DateTime.fromJSDate(message.createdAt)
                  .diffNow()
                  .negate()
                  .as("hours") < 1,
            )
            .reverse()
            .values(),
        )
      } while (messages.size === 100)

      return
    }

    let before = thread.id
    const allMessages = []
    do {
      messages = await interaction.channel.messages.fetch({
        limit: 100,
        before,
      })
      for (const message of messages.values()) {
        if (message.author.bot && message.reference === null) {
          messages.clear()
          break
        }

        allMessages.push(message)
      }

      before = messages.lastKey() ?? thread.id
    } while (messages.size === 100)

    enqueue(...allMessages.reverse())
  },
})

async function generateFooter(guildOrClient: Guild | Client) {
  const guild =
    guildOrClient instanceof Client
      ? await guildOrClient.guilds.fetch(Config.guild)
      : guildOrClient
  const footer: EmbedFooterOptions = { text: guild.name }
  const iconUrl = guild.iconURL()
  if (iconUrl) {
    footer.iconURL = iconUrl
  }

  return footer
}

function disableComponents(message: Message) {
  const components = message.components.map(
    (row) =>
      new ActionRowBuilder<MessageActionRowComponentBuilder>(row.toJSON()),
  )

  for (const row of components) {
    for (const component of row.components) {
      component.setDisabled(true)
    }
  }

  return { components }
}

function addCloseButton(message: MessageCreateOptions) {
  return {
    ...message,
    components: [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(
        new ButtonBuilder()
          .setCustomId(closeThreadButton())
          .setLabel("Close thread")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  }
}

const closeThreadButton = component({
  type: ComponentType.Button,
  name: "close",
  async handle(interaction) {
    if (!interaction.inCachedGuild()) {
      return
    }

    const [thread] = await Drizzle.select()
      .from(threadsTable)
      .where(
        and(
          eq(threadsTable.id, interaction.channelId),
          eq(threadsTable.open, true),
        ),
      )

    if (!thread) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Can't close thread")
            .setDescription(
              "This thread can't be closed, either because it has previously been closed, or because it doesn't exist.",
            )
            .setColor(Colours.red[500]),
        ],
        ephemeral: true,
      })
      return
    }

    await interaction.update({ components: [] })

    await Drizzle.update(threadsTable)
      .set({ open: null })
      .where(eq(threadsTable.id, thread.id))

    const channel = await fetchChannel(
      interaction.client,
      interaction.channelId,
      ChannelType.PublicThread,
    )

    const message = {
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: interaction.user.displayName,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle("Thread closed")
          .setColor(Colours.red[500])
          .setFooter(await generateFooter(interaction.guild))
          .setTimestamp(interaction.createdAt),
      ],
    }

    await channel.send(message)

    try {
      const user = await interaction.client.users.fetch(thread.user)
      await user.send(message)
    } catch (e) {
      if (
        !(e instanceof DiscordAPIError) ||
        (e.code !== RESTJSONErrorCodes.UnknownUser &&
          e.code !== RESTJSONErrorCodes.CannotSendMessagesToThisUser)
      ) {
        throw e
      }
    }

    await channel.messages.edit(thread.id, {
      content: `${bold(interaction.user.displayName)}: [thread closed]`,
    })

    await channel.edit({
      appliedTags: [Tags.closed.id].filter((t) => t !== null),
      locked: true,
      archived: true,
      name: `${channel.name} (closed)`,
    })
  },
})

async function threadAlreadyExists(interaction: ButtonInteraction) {
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Thread already exists")
        .setDescription(
          "You already have an open mod mail thread, and cannot create a new thread until the existing thread is closed.",
        ),
    ],
    ephemeral: true,
  })
  return
}
