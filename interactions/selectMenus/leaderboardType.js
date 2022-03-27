const interactionUtils = require("../../services/interactionUtils");
const statsService = require("../../services/statsService");

module.exports = {
    customId: 'leaderboard_type_select',
    async execute(interaction) {
        let statsType = interaction.values[0]
        let guildId
        if (statsType === 'team') {
            guildId = interaction.guildId
        }
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region, guildId)
        let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region, guildId })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page: 0, lineupSizes: [] }, numberOfPages)
        interaction.message.components[0] = leaderboardPaginationComponent
        interaction.message.components[2] = interactionUtils.createLeaderBoardLineupSizeComponent(statsType)
        await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
    }
}