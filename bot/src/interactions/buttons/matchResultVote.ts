import { BaseGuildTextChannel, ButtonInteraction, EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService, MatchResult, MatchResultType } from "../../services/matchmakingService";
import { regionService } from "../../services/regionService";
import { TeamLogoDisplay } from "../../services/teamService";
import { handle } from "../../utils";

export default {
    customId: 'match_result_vote_',
    async execute(interaction: ButtonInteraction) {
        const result = parseInt(interaction.customId.split('_')[3]) as MatchResult
        const matchId = interaction.customId.split('_')[4]
        const lineupNumber = parseInt(interaction.customId.split('_')[5])

        let match = await matchmakingService.findMatchByMatchId(matchId)
        if (match === null) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const captainUserId = lineupNumber === 1 ? match.result?.firstLineup.captainUserId! : match.result?.secondLineup.captainUserId!
        if (!authorizationService.isMatchmakingAdmin(interaction.member as GuildMember) && interaction.user.id !== captainUserId) {
            const [user] = await handle(interaction.client.users.fetch(captainUserId))
            await interaction.reply({ content: `Only ${user} is allowed to vote`, ephemeral: true })
            return
        }

        if (match.result!.isVoted()) {
            await interaction.reply({ content: '⛔ The outcome of this match has already been voted', ephemeral: true })
            return
        }

        let existingLineupResult = lineupNumber === 1 ? match.result!.firstLineup.result : match.result!.secondLineup.result
        if (existingLineupResult != null) {
            await interaction.reply({ content: '⛔ You have already voted for this match outcome', ephemeral: true })
            return
        }

        let [lineup, opponentLineup] = lineupNumber === 1 ? [match.firstLineup, match.secondLineup] : [match.secondLineup, match.firstLineup]
        const lineupChannel = await interaction.client.channels.fetch(lineup.channelId) as BaseGuildTextChannel
        const opponentLineupChannel = opponentLineup.isNotTeam() ? lineupChannel : await interaction.client.channels.fetch(opponentLineup.channelId) as BaseGuildTextChannel
        const teamName = lineup.isTeam() ? lineup.prettyPrintName() : lineupNumber === 1 ? "Red Team" : "Blue Team"

        match = (await matchmakingService.updateMatchResult(matchId, lineupNumber, result))!

        const voteNotificationMessageEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle('🗳️ Match Result Submitted')
            .setFields([
                { name: 'Match ID', value: matchId, inline: true },
                { name: 'Result', value: `${MatchResultType.toString(result)}`, inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: 'Voter', value: `${interaction.user}`, inline: true },
                { name: 'Team', value: teamName, inline: true }
            ])
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user.username}` })
        const voteNotificationMessage = { embeds: [voteNotificationMessageEmbed] }
        if (lineupChannel.id !== opponentLineup.channelId) {
            await opponentLineupChannel.send(voteNotificationMessage)
        }
        await interaction.update({ components: [] })
        await lineupChannel.send(voteNotificationMessage)

        if (match.result!.isVoted()) {
            const firstLineupResult = match.result!.firstLineup!.result
            const secondLineupResult = match.result!.secondLineup!.result
            if ((firstLineupResult === MatchResult.DRAW && secondLineupResult === MatchResult.DRAW) ||
                (firstLineupResult === MatchResult.WIN && secondLineupResult === MatchResult.LOSS) ||
                (firstLineupResult === MatchResult.LOSS && secondLineupResult === MatchResult.WIN) ||
                (firstLineupResult === MatchResult.CANCEL && secondLineupResult === MatchResult.CANCEL)
            ) {
                let votesResultEmbed
                if (match.result!.isCancelled()) {
                    votesResultEmbed = new EmbedBuilder()
                        .setColor('#ed4245')
                        .setTitle('❌ Match Cancelled')
                        .setDescription('Both captains voted to cancel the match')
                        .setTimestamp()
                } else {
                    await matchmakingService.updateRatings(interaction.client, match)
                    votesResultEmbed = new EmbedBuilder()
                        .setColor('#6aa84f')
                        .setTitle('✅ Votes are consistent')
                        .setDescription('Team and Players ratings have been updated !')
                        .setTimestamp()
                }
                const votesResultMessage = { embeds: [votesResultEmbed] }
                if (lineupChannel.id !== opponentLineup.channelId) {
                    await opponentLineupChannel.send(votesResultMessage)
                }
                await lineupChannel.send(votesResultMessage)

                const channelId = regionService.getRegionData(match.firstLineup.team.region).matchResultsChannelId
                if (channelId) {
                    const [channel] = await handle(interaction.client.channels.fetch(channelId))
                    if (channel instanceof TextChannel) {
                        const matchResultEmbed = new EmbedBuilder()
                            .setTitle(`${match.firstLineup.size}v${match.secondLineup.size}`)
                            .setDescription(`${match.firstLineup.prettyPrintName(TeamLogoDisplay.RIGHT)} ${MatchResultType.toEmoji(match.result!.firstLineup.result!)} **VS** ${MatchResultType.toEmoji(match.result!.secondLineup.result!)} ${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)}`)
                            .setColor('#6aa84f')
                            .setFooter({ text: `Match ID: ${match.matchId}` })
                            .setTimestamp()
                        handle(channel.send({ embeds: [matchResultEmbed] }))
                    }
                }
            } else {
                await matchmakingService.resetMatchResult(matchId)
                const inconsistentVotesMessageEmbed = new EmbedBuilder()
                    .setColor('#6aa84f')
                    .setTitle('⛔ Results are inconsistent. Please submit again.')
                    .setTimestamp()
                const inconsistentVotesMessage = { embeds: [inconsistentVotesMessageEmbed] }
                if (lineupChannel.id !== opponentLineup.channelId) {
                    await opponentLineupChannel.send(inconsistentVotesMessage)
                }
                await lineupChannel.send(inconsistentVotesMessage)

                const captainUser = await interaction.client.users.fetch(captainUserId)
                await lineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, captainUser, lineupNumber))

                const opponentTeamCaptainUser = await interaction.client.users.fetch(lineupNumber === 1 ? match.result?.secondLineup.captainUserId! : match.result?.firstLineup.captainUserId!)
                await opponentLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, opponentTeamCaptainUser, lineupNumber === 1 ? 2 : 1))
            }
        }
    }
} as IButtonHandler