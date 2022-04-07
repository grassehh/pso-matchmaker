const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");
const statsService = require("../../services/statsService");

module.exports = {
    customId: 'select_bench_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[2])
        const selectedRoleToBench = interaction.values[0]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)

        if (!roles.find(role => role.name === selectedRoleToBench).user) {
            await interaction.reply({ content: `The ${selectedRoleToBench} is already empty !`, ephemeral: true })
            return
        }

        let userToAdd = {
            id: interaction.user.id,
            name: interaction.user.username,
            emoji: statsService.getLevelEmojiFromMember(interaction.member)
        }

        lineup = await teamService.addUserToBench(interaction.channelId, selectedRoleToBench, userToAdd, selectedLineupNumber)

        let description = `:outbox_tray: ${interaction.user} benched the **${selectedRoleToBench}** position`
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