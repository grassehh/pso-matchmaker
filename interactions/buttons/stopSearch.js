const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'stopSearch',
    async execute(interaction) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }
        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (!lineupQueue) {
            await interactionUtils.replyNotQueued(interaction)
            return
        }
        await matchmakingService.leaveQueue(interaction.client, lineupQueue)
        await interaction.message.edit({ components: [] })
        const embed = interactionUtils.createInformationEmbed(interaction.user, `😴 Your team is no longer searching for a challenge`)
        await interaction.channel.send({ embeds: [embed], components: interactionUtils.createLineupComponents(lineupQueue.lineup, null, challenge) })
    }
}