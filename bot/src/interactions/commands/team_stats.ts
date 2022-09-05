import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_stats')
        .setDescription("Display your team stats or another team's stats")
        .addStringOption(option => option.setName('team_id')
            .setRequired(false)
            .setDescription('The ID of the team you to see the stats')),
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.options.getString('team_id') ? interaction.options.getString('team_id')! : interaction.guildId!
        const team = await teamService.findTeamByGuildId(guildId)
        if (!team) {
            await interaction.reply('⛔ This team does not exist')
            return
        }

        const region = team ? team.region : Region.INTERNATIONAL
        await interaction.reply((await interactionUtils.createTeamStatsReply(team, region)) as InteractionReplyOptions)
    }
} as ICommandHandler;