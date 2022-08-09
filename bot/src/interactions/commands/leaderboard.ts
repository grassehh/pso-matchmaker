import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { GameType, interactionUtils, StatsScope, StatsType } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(`Display stats of all teams and players`),
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const reply = await interactionUtils.createLeaderboardReply(interaction, team, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, statsScope: StatsScope.REGIONAL, statsType: StatsType.TEAMS, gameType: GameType.TEAM_AND_MIX })
        await interaction.reply(reply as InteractionReplyOptions)
    }
} as ICommandHandler;