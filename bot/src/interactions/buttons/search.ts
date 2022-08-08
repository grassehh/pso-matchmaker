import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    customId: 'search_',
    async execute(interaction: ButtonInteraction) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply({ content: "⛔ You are currently challenging", ephemeral: true })
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (lineupQueue) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(lineupQueue.lineup.size))
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const ranked = interaction.customId.split('_')[1] === 'ranked'
        if (ranked && !lineup.isAllowedToPlayRanked()) {
            interaction.reply({ content: '⛔ Your team is not allowed to play ranked matchmaking', ephemeral: true })
            return
        }

        if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
            interaction.reply({ content: '⛔ All outfield positions must be filled before searching', ephemeral: true })
            return
        }

        await interaction.deferReply()
        lineupQueue = await matchmakingService.joinQueue(lineup, ranked)
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, `🔎 Your team is now searching for a **${ranked ? 'Ranked' : 'Casual'}** match to play`)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.embeds!.splice(0, 0, informationEmbed)
        await interaction.editReply(reply)
    }
} as IButtonHandler