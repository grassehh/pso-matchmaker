const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'startSearch',
    async execute(interaction) {
        await interaction.deferReply();
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (lineupQueue) {
            await interactionUtils.replyAlreadyQueued(interaction, lineupQueue.lineup.size)
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
            interaction.reply({ content: '⛔ All outfield positions must be filled before searching', ephemeral: true })
            return
        }

        lineupQueue = await matchmakingService.joinQueue(interaction.client, interaction.user, lineup)
        interaction.message.edit({ components: [] })
        const embed = interactionUtils.createInformationEmbed(interaction.user, `🔎 Your team is now searching for a team to challenge`)
        await interaction.editReply({ embeds: [embed], components: interactionUtils.createLineupComponents(lineup, lineupQueue, challenge) })
    }
}