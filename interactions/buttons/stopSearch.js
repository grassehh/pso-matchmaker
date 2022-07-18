const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    customId: 'stopSearch',
    async execute(interaction) {
        await interaction.deferReply();
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }

        const lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (!lineupQueue) {
            await interactionUtils.replyNotQueued(interaction)
            return
        }

        await matchmakingService.leaveQueue(interaction.client, lineupQueue)
        interaction.message.edit({ components: [] })
        const embed = interactionUtils.createInformationEmbed(interaction.user, `😴 Your team is no longer searching for a challenge`)
        await interaction.editReply({ embeds: [embed], components: interactionUtils.createLineupComponents(lineupQueue.lineup, null, challenge) })
    }
}