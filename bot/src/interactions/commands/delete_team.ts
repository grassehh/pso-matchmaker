import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('delete_team')
        .setDescription('Deletes this team'),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const deleteTeamActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_team_yes_${team.guildId}`)
                    .setLabel(`Yes`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`delete_team_no_${team.guildId}`)
                    .setLabel(`No`)
                    .setStyle(ButtonStyle.Primary)
            )
        await interaction.reply({ content: '🛑 This will delete your team and all associated lineups', components: [deleteTeamActionRow], ephemeral: true })
    },
} as ICommandHandler