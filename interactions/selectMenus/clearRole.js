const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'select_clearRole_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[2])
        const selectedRoleToClear = interaction.values[0]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
        if (!roles.find(role => role.name === selectedRoleToClear).user) {
            await interaction.reply({ content: `The ${selectedRoleToClear} is already empty !`, ephemeral: true })
            return
        }

        lineup = await teamService.clearRoleFromLineup(interaction.channelId, selectedRoleToClear, selectedLineupNumber)

        let description = `:outbox_tray: ${interaction.user} cleared the **${selectedRoleToClear}** position`
        const autoSearchResult = await matchmakingService.checkIfAutoSearch(interaction.client, interaction.user, lineup)
        if (autoSearchResult.leftQueue) {
            description += `\nYou are no longer searching for a team.`
        }
        if (autoSearchResult.cancelledChallenge) {
            description += `\nThe challenge request has been cancelled.`
        }
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, autoSearchResult.updatedLineupQueue)
        const embed = interactionUtils.createInformationEmbed(interaction.user, description)
        reply.embeds = (reply.embeds || []).concat(embed)
        await interaction.update({ components: [] })
        await interaction.channel.send(reply)
    }
}