const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'cancel_sub_request_',
    async execute(interaction) {
        const matchId = interaction.customId.split('_')[3]
        const match = await matchmakingService.findMatchByMatchId(matchId)

        if (!match) {
            await interactionUtils.replyMatchDoesntExist(interaction)
            return
        }

        const userRole = match.findUserRole(interaction.user)
        if (!userRole) {
            await interaction.reply({ content: '⛔ You must be in the match to cancel the sub request', ephemeral: true })
            return
        }

        const embed = interaction.message.embeds[0]
        embed.title = `~~${embed.title}~~`
        embed.description = `~~${embed.description}~~\n${interaction.user} cancelled the request`
        await interaction.message.delete()
    }
}