import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_unban')
        .setDescription('Unban a team from using the bot in this team')
        .addStringOption(option => option.setName('team_id')
            .setRequired(true)
            .setDescription('The id of the team to ban. For example: 123456789012345678')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isRegionalDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only regional discord are allowed to unban team', ephemeral: true })
            return
        }

        const guildId = interaction.options.getString('team_id')!
        const team = await teamService.findTeamByGuildId(guildId)
        if (!team) {
            await interaction.reply({ content: '⛔ This team does not exist', ephemeral: true })
            return
        }

        if (team.region !== regionService.getRegionByGuildId(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ You are not allowed to unban a team that is not in your region', ephemeral: true })
            return
        }

        const res = await teamService.deleteTeamBan(team.guildId)
        if (res.deletedCount === 0) {
            await interaction.reply({ content: `⛔ Team ${team.prettyPrintName()} is not banned`, ephemeral: true })
            return
        }

        await teamService.notifyUnbanned(interaction.client, team)
        await interaction.reply({ content: `✅ Team ${team.prettyPrintName()} is now unbanned` })
        return
    }
} as ICommandHandler