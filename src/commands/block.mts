/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { slashCommand } from "../models/slashCommand.mjs"
import { blocksTable } from "../schema.mjs"
import { EmbedBuilder, PermissionFlagsBits } from "discord.js"
import { eq } from "drizzle-orm"

export const BlockCommand = slashCommand({
  name: "block",
  description: "Block or unblock a user from creating mail threads",
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  nsfw: false,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  options: [
    {
      name: "user",
      type: "user",
      description: "The user to block or unblock",
      required: true,
    },
  ],
  async handle(interaction, user) {
    const [existing] = await Drizzle.select()
      .from(blocksTable)
      .where(eq(blocksTable.id, user.id))
    if (existing) {
      await Drizzle.delete(blocksTable).where(eq(blocksTable.id, user.id))
    } else {
      await Drizzle.insert(blocksTable).values({ id: user.id })
    }

    const verb = existing ? "unblocked" : "blocked"

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`User ${verb}`)
          .setDescription(
            `Successfully ${verb} ${user.displayName} from creating mail threads.`,
          ),
      ],
      ephemeral: true,
    })
  },
})
