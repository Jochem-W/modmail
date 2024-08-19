/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { Drizzle } from "../clients.mjs"
import { InstallationContext, InteractionContext } from "../models/command.mjs"
import { slashCommand, slashSubcommand } from "../models/slashCommand.mjs"
import { pingsTable } from "../schema.mjs"
import { EmbedBuilder, PermissionFlagsBits } from "discord.js"
import { eq } from "drizzle-orm"

export const ThreadCommand = slashCommand({
  name: "thread",
  description: "Commands related to threads",
  nsfw: false,
  contexts: [InteractionContext.Guild],
  integrationTypes: [InstallationContext.GuildInstall],
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  subcommands: [
    slashSubcommand({
      name: "ping",
      description: "Get pinged and added to threads as they are created",
      async handle(interaction) {
        const [existing] = await Drizzle.select()
          .from(pingsTable)
          .where(eq(pingsTable.id, interaction.user.id))
        if (existing) {
          await Drizzle.delete(pingsTable).where(
            eq(pingsTable.id, interaction.user.id),
          )
        } else {
          await Drizzle.insert(pingsTable).values({ id: interaction.user.id })
        }

        const verb = existing ? "Removed" : "Added"
        const preposition = existing ? "from" : "to"

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${verb} from pinglist`)
              .setDescription(
                `You've successfully ${verb.toLowerCase()} yourself ${preposition} the pinglist.`,
              ),
          ],
          ephemeral: true,
        })
      },
    }),
  ],
})
