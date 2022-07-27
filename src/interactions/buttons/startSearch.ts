import { ButtonInteraction, Message } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'startSearch',
    async execute(interaction: ButtonInteraction) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (lineupQueue) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(lineupQueue.lineup.size))
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
            interaction.reply({ content: '⛔ All outfield positions must be filled before searching', ephemeral: true })
            return
        }

        await (interaction.message as Message).edit({ components: [] })
        await interaction.deferReply()
        lineupQueue = await matchmakingService.joinQueue(interaction.client, interaction.user, lineup)
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, `🔎 Your team is now searching for a team to challenge`)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.embeds!.splice(0, 0, informationEmbed)
        await interaction.editReply(reply)
    }
} as IButtonHandler