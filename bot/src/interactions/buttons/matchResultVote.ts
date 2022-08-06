import { BaseGuildTextChannel, ButtonInteraction, EmbedBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineupMatchResult } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService, MatchResult, MatchResultType } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";
import { handle } from "../../utils";

export default {
    customId: 'match_result_vote_',
    async execute(interaction: ButtonInteraction) {
        const result = parseInt(interaction.customId.split('_')[3]) as MatchResult
        const matchId = interaction.customId.split('_')[4]
        const userId = interaction.customId.split('_')[5]

        if (interaction.user.id !== userId) {
            const [user] = await handle(interaction.client.users.fetch(userId))
            await interaction.reply({ content: `Only ${user} is allowed to vote`, ephemeral: true })
            return
        }

        let match = await matchmakingService.findMatchByMatchId(matchId)
        if (match === null) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        if (match.result.firstLineup && match.result.secondLineup) {
            await interaction.reply({ content: '⛔ The outcome of this match has already been voted', ephemeral: true })
            return
        }

        const existingLineupResult = interaction.channelId === match.firstLineup.channelId ? match.result.firstLineup : match.result.secondLineup
        if (existingLineupResult) {
            await interaction.reply({ content: '⛔ You have already voted for this match outcome', ephemeral: true })
            return
        }

        let lineupResult: ILineupMatchResult = {
            captainUserId: userId,
            result
        }

        const lineupToUpdate = interaction.channelId === match.firstLineup.channelId ? 1 : 2
        match = (await matchmakingService.updateMatchResult(matchId, lineupToUpdate, lineupResult))!

        const lineup = interaction.channelId === match.firstLineup.channelId ? match.firstLineup : match.secondLineup!
        const opponentLineup = interaction.channelId === match.firstLineup.channelId ? match.secondLineup! : match.firstLineup

        const voteNotificationMessageEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle('🗳️ Match Vote Submitted')
            .setFields([
                { name: 'Match ID', value: matchId, inline: true },
                { name: 'Result', value: `${MatchResultType.toString(result)}`, inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: 'Voter', value: `${interaction.user}`, inline: true },
                { name: 'Team', value: `${teamService.formatTeamName(lineup)}`, inline: true }
            ])
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user}` })
        const voteNotificationMessage = { embeds: [voteNotificationMessageEmbed] }
        const otherLineupChannel = await interaction.client.channels.fetch(opponentLineup.channelId) as BaseGuildTextChannel
        await otherLineupChannel.send(voteNotificationMessage)
        await interaction.update({ components: [] })
        await interaction.followUp(voteNotificationMessage)

        if (match.result.firstLineup && match.result.secondLineup) {
            const firstLineupResult = match.result.firstLineup.result
            const secondLineupResult = match.result.secondLineup.result
            if (
                (firstLineupResult === MatchResult.DRAW && secondLineupResult === MatchResult.DRAW) ||
                (firstLineupResult === MatchResult.WIN && secondLineupResult === MatchResult.LOSS) ||
                (firstLineupResult === MatchResult.LOSS && secondLineupResult === MatchResult.WIN)
            ) {
                await matchmakingService.updateRatings(match)
                const ratingUpdatedEmbed = new EmbedBuilder()
                    .setColor('#6aa84f')
                    .setTitle('✅ Votes are consistent')
                    .setDescription('Team and Players ratings have been updated !')
                    .setTimestamp()
                const ratingUpdatedMessage = { embeds: [ratingUpdatedEmbed] }
                await otherLineupChannel.send(ratingUpdatedMessage)
                await interaction.followUp(ratingUpdatedMessage)
            } else {
                await matchmakingService.resetMatchResult(matchId)
                const inconsistentVotesMessageEmbed = new EmbedBuilder()
                    .setColor('#6aa84f')
                    .setTitle('⛔ Vote are inconsistent. Please vote again.')
                    .setTimestamp()
                const inconsistentVotesMessage = { embeds: [inconsistentVotesMessageEmbed] }
                await otherLineupChannel.send(inconsistentVotesMessage)
                await interaction.followUp(inconsistentVotesMessage)

                await interaction.channel?.send(interactionUtils.createMatchResultVoteReply(match.matchId, match.firstLineup.team.region, interaction.user))
                const opponentTeamCaptainUserId = await matchmakingService.findHighestRatedUserId(opponentLineup)
                const opponentTeamCaptainUser = await interaction.client.users.fetch(opponentTeamCaptainUserId)
                await otherLineupChannel.send(interactionUtils.createMatchResultVoteReply(match.matchId, match.firstLineup.team.region, opponentTeamCaptainUser))
            }
        }
    }
} as IButtonHandler