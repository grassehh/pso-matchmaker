import { ButtonInteraction, InteractionUpdateOptions } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { GameType, interactionUtils, StatsType } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";

export default {
    customId: 'leaderboard_page_',
    async execute(interaction: ButtonInteraction) {
        const split = interaction.customId.split('_')
        const customIdPage = split[2]
        let page
        if (customIdPage === 'last') {
            page = -1
        } else if (customIdPage === 'first') {
            page = 0
        } else {
            page = parseInt(customIdPage)
        }

        const region: Region = split[3] as Region
        const statsType: StatsType = parseInt(split[4])
        const gameType: GameType = parseInt(split[5])
        const reply = await interactionUtils.createLeaderboardReply(interaction, { page, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, region, statsType, gameType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as IButtonHandler