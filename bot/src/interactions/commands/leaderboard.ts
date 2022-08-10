import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { GameType, interactionUtils, StatsType } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(`Display stats of all teams and players`),
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        const region = team ? team.region : Region.INTERNATIONAL
        const reply = await interactionUtils.createLeaderboardReply(interaction, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, region, statsType: StatsType.TEAMS, gameType: GameType.TEAM_AND_MIX })
        await interaction.reply(reply as InteractionReplyOptions)
    }
} as ICommandHandler;