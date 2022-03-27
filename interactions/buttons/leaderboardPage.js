const interactionUtils = require("../../services/interactionUtils");
const statsService = require("../../services/statsService");

module.exports = {
    customId: 'leaderboard_page_',
    async execute(interaction) {
        let split = interaction.customId.split('_')
        let statsType = split[2]
        let lineupSizes = split[3].split(',').filter(i => i)
        let page = parseInt(split[4])
        let guildId
        if (statsType === 'team') {
            guildId = interaction.guildId
        }
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let numberOfPlayers = await statsService.countNumberOfPlayers(region, guildId, lineupSizes)
        let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region, guildId, page, lineupSizes })
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType, page, lineupSizes }, numberOfPages)
        interaction.message.components[0] = leaderboardPaginationComponent
        await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
    }
}