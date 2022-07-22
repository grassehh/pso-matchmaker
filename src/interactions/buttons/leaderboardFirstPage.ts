import { ButtonInteraction, MessageActionRow } from "discord.js";
import { interactionUtils, statsService } from "../../beans";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'leaderboard_first_page_',
    async execute(interaction: ButtonInteraction) {
        let split = interaction.customId.split('_')
        let statsType = split[3]
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region)
        let numberOfPages = Math.ceil(numberOfPlayers / DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page: 0 }, numberOfPages)
        interaction.message.components![0] = leaderboardPaginationComponent
        await interaction.update({ embeds: statsEmbeds, components: interaction.message.components as MessageActionRow[] })
    }
} as IButtonHandler