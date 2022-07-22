import { MessageActionRow, SelectMenuInteraction } from "discord.js";
import { interactionUtils, statsService } from "../../beans";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";

export default {
    customId: 'leaderboard_type_select',
    async execute(interaction: SelectMenuInteraction) {
        let statsType = interaction.values[0]
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
} as ISelectMenuHandler