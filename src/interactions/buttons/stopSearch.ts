import { ButtonInteraction, Message } from "discord.js";
import { interactionUtils, matchmakingService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'stopSearch',
    async execute(interaction: ButtonInteraction) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }

        const lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (!lineupQueue) {
            await interaction.reply(interactionUtils.createReplyNotQueued())
            return
        }

        await (interaction.message as Message).edit({ components: [] })
        await interaction.deferReply()
        await matchmakingService.leaveQueue(interaction.client, lineupQueue)
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, `😴 Your team is no longer searching for a challenge`)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineupQueue.lineup)
        reply.embeds!.splice(0, 0, informationEmbed)
        await interaction.editReply(reply)
    }
} as IButtonHandler