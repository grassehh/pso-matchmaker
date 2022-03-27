const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'cancel_challenge_',
    async execute(interaction) {
        const challengeId = interaction.customId.substring(17);
        await matchmakingService.cancelChallenge(interaction.client, interaction.user, challengeId)
    }
}