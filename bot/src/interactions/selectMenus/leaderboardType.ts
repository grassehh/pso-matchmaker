import { ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, SelectMenuInteraction } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { statsService } from "../../services/statsService";

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
        
        let components: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] = []
        interaction.message.components.forEach(component => {
            components.push(ActionRowBuilder.from(component) as ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>)
        })
        components[0] = leaderboardPaginationComponent

        await interaction.update({ embeds: statsEmbeds, components })
    }
} as ISelectMenuHandler