const interactionUtils = require("../../services/interactionUtils");
const statsService = require("../../services/statsService");

module.exports = {
    customId: 'leaderboard_page_',
    async execute(interaction) {
        let split = interaction.customId.split('_')
        let statsType = split[2]
        let page = parseInt(split[3])
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region)
        let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region, page })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page }, numberOfPages)
        interaction.message.components[0] = leaderboardPaginationComponent
        await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
    }
}