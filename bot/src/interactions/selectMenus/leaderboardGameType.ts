import { InteractionUpdateOptions, SelectMenuInteraction } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { GameType, interactionUtils, StatsType } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";

export default {
    customId: 'leaderboard_game_type_select',
    async execute(interaction: SelectMenuInteraction) {
        const gameType: GameType = parseInt(interaction.values[0])
        const statsType: StatsType = parseInt(interaction.customId.split('_')[4])
        const region: Region = interaction.customId.split('_')[5] as Region
        const reply = await interactionUtils.createLeaderboardReply(interaction, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, region, statsType, gameType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as ISelectMenuHandler