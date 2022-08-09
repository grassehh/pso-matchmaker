import { InteractionUpdateOptions, SelectMenuInteraction } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { GameType, interactionUtils, StatsScope, StatsType } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaderboard_game_type_select',
    async execute(interaction: SelectMenuInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const gameType: GameType = parseInt(interaction.values[0])
        const statsType: StatsType = parseInt(interaction.customId.split('_')[4])
        const statsScope: StatsScope = parseInt(interaction.customId.split('_')[5])
        const reply = await interactionUtils.createLeaderboardReply(interaction, team, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, statsScope, statsType, gameType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as ISelectMenuHandler