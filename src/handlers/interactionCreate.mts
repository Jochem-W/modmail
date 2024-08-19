/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import { RegisteredCommands } from "../commands.mjs"
import { Components } from "../components.mjs"
import { logError } from "../errors.mjs"
import { Modals } from "../modals.mjs"
import { handler } from "../models/handler.mjs"
import { makeErrorMessage } from "../utilities/embed.mjs"
import {
  AutocompleteInteraction,
  CommandInteraction,
  InteractionType,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js"

async function handleCommand(interaction: CommandInteraction) {
  const command = RegisteredCommands.get(interaction.commandId)
  if (!command) {
    throw new Error(`Couldn't find a command with ID ${interaction.commandId}`)
  }

  if (command.type !== interaction.commandType) {
    throw new Error(
      `Command ${interaction.commandId} is of type ${command.type} (expected ${interaction.commandType})`,
    )
  }

  await command.handle(interaction as never)
}

async function handleComponent(interaction: MessageComponentInteraction) {
  const [componentName] = interaction.customId.split(":")
  if (!componentName) {
    throw new Error(`Component has invalid custom ID ${interaction.customId}`)
  }

  const component = Components.get(componentName)
  if (!component) {
    throw new Error(`Couldn't find a component with name ${componentName}`)
  }

  if (component.type !== interaction.componentType) {
    throw new Error(
      `Component ${componentName} is of type ${component.type} (expected ${interaction.componentType})`,
    )
  }

  await component.handle(interaction as never)
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const command = RegisteredCommands.get(interaction.commandId)
  if (!command) {
    throw new Error(`Couldn't find a command with ID ${interaction.commandId}`)
  }

  if (command.type !== interaction.commandType) {
    throw new Error(
      `Command ${interaction.commandId} is of type ${command.type} (expected ${interaction.commandType})`,
    )
  }

  await command.autocomplete(interaction)
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const [modalName] = interaction.customId.split(":")
  if (!modalName) {
    throw new Error(`Modal has invalid custom ID ${interaction.customId}`)
  }

  const modal = Modals.get(modalName)
  if (!modal) {
    throw new Error(`Couldn't find a modal with name ${modalName}`)
  }

  await modal(interaction)
}

export const InteractionHandler = handler({
  event: "interactionCreate",
  once: false,
  async handle(interaction) {
    try {
      switch (interaction.type) {
        case InteractionType.ApplicationCommand:
          await handleCommand(interaction)
          break
        case InteractionType.MessageComponent:
          await handleComponent(interaction)
          break
        case InteractionType.ApplicationCommandAutocomplete:
          await handleAutocomplete(interaction)
          break
        case InteractionType.ModalSubmit:
          await handleModal(interaction)
          break
        default:
          break
      }
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }

      await logError(interaction.client, e)

      if (!interaction.isRepliable()) {
        return
      }

      const message = makeErrorMessage(e)
      if (interaction.replied) {
        await interaction.editReply(message)
        return
      }

      await interaction.reply({ ...message, ephemeral: true })
    }
  },
})
