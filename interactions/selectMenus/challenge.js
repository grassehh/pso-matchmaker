const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'challenge_select',
    async execute(interaction) {
        await matchmakingService.challenge(interaction, interaction.values[0])
    }
}