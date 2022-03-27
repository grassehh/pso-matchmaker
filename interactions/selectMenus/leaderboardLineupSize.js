const interactionUtils = require("../../services/interactionUtils");
const statsService = require("../../services/statsService");

module.exports = {
    customId: 'leaderboard_lineup_size_select_',
    async execute(interaction) {
        let split = interaction.customId.split('_')
        let statsType = split[4]
        let selectedSizes = interaction.values
        let guildId
        if (statsType === 'team') {
            guildId = interaction.guildId
        }
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region, guildId, selectedSizes)
        let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region, guildId, lineupSizes: selectedSizes })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page: 0, lineupSizes: selectedSizes }, numberOfPages)
        interaction.message.components[0] = leaderboardPaginationComponent
        await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
    }
}