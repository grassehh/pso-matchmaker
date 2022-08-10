import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('player_stats')
        .setDescription("Display your own stats or another player's stats")
        .addUserOption(option => option.setName('player')
            .setRequired(false)
            .setDescription('The player you to see the stats')),
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        const region = team ? team.region : Region.INTERNATIONAL
        const player = interaction.options.getUser('player')
        const user = player ? player : interaction.user
        await interaction.reply((await interactionUtils.createPlayerStatsReply(user, region)) as InteractionReplyOptions)
    }
} as ICommandHandler;