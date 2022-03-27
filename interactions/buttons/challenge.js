const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'challenge_',
    async execute(interaction) {
        let lineupQueueIdToChallenge = interaction.customId.substring(10);
        await matchmakingService.challenge(interaction, lineupQueueIdToChallenge)
    }
}