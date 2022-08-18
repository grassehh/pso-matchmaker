import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('delete_account')
        .setDescription('Deletes your account and all associated data from the bot'),
    async execute(interaction: ChatInputCommandInteraction) {
        const deleteAccountActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_account_yes_${interaction.user.id}`)
                    .setLabel(`Yes`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`delete_account_no_${interaction.user.id}`)
                    .setLabel(`No`)
                    .setStyle(ButtonStyle.Primary)
            )
        await interaction.reply({ content: '🛑 This will delete your account and **all** its data from **every regions** (stats, steam account connexion etc.)', components: [deleteAccountActionRow], ephemeral: true })
    },
} as ICommandHandler