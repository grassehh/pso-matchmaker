import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, SelectMenuBuilder } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { statsService } from "../../services/statsService";

export default {
    customId: 'leaderboard_page_',
    async execute(interaction: ButtonInteraction) {
        let split = interaction.customId.split('_')
        let statsType = split[2]
        let page = parseInt(split[3])
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region)
        let numberOfPages = Math.ceil(numberOfPlayers / DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region, page })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page }, numberOfPages)


        let components: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] = []
        interaction.message.components.forEach(component => {
            components.push(ActionRowBuilder.from(component) as ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>)
        })
        components[0] = leaderboardPaginationComponent
        await interaction.update({ embeds: statsEmbeds, components })
    }
} as IButtonHandler