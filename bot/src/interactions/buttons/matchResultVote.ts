import { BaseGuildTextChannel, ButtonInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineupMatchResult } from "../../mongoSchema";
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

        let lineup, opponentLineup
        let otherLineupChannel
        let existingLineupResult
        let teamName
        let lineupToUpdate
        if (match.firstLineup.isNotTeam() && match.secondLineup.isNotTeam()) {
            lineup = match.firstLineup
            opponentLineup = match.secondLineup
            otherLineupChannel = interaction.channel!
            existingLineupResult = match.firstLineup.roles.some(role => role.user?.id === interaction.user.id) ? match.result.firstLineup : match.result.secondLineup
            teamName = match.firstLineup.roles.some(role => role.user?.id === interaction.user.id) ? "Red Team" : "Blue Team"
            lineupToUpdate = match.firstLineup.roles.some(role => role.user?.id === interaction.user.id) ? 1 : 2
        } else {
            lineup = interaction.channelId === match.firstLineup.channelId ? match.firstLineup : match.secondLineup
            opponentLineup = interaction.channelId === match.firstLineup.channelId ? match.secondLineup : match.firstLineup
            otherLineupChannel = await interaction.client.channels.fetch(opponentLineup.channelId) as BaseGuildTextChannel
            existingLineupResult = interaction.channelId === match.firstLineup.channelId ? match.result.firstLineup : match.result.secondLineup
            teamName = lineup.prettyPrintName()
            lineupToUpdate = interaction.channelId === match.firstLineup.channelId ? 1 : 2
        }

        if (existingLineupResult) {
            await interaction.reply({ content: '⛔ You have already voted for this match outcome', ephemeral: true })
            return
        }

        let lineupResult: ILineupMatchResult = {
            captainUserId: userId,
            result
        }
        match = (await matchmakingService.updateMatchResult(matchId, lineupToUpdate, lineupResult))!

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
        if (interaction.channelId !== opponentLineup.channelId) {
            await otherLineupChannel.send(voteNotificationMessage)
        }
        await interaction.update({ components: [] })
        await interaction.followUp(voteNotificationMessage)

        if (match.result.firstLineup && match.result.secondLineup) {
            const firstLineupResult = match.result.firstLineup.result
            const secondLineupResult = match.result.secondLineup.result
            if ((firstLineupResult === MatchResult.DRAW && secondLineupResult === MatchResult.DRAW) ||
                (firstLineupResult === MatchResult.WIN && secondLineupResult === MatchResult.LOSS) ||
                (firstLineupResult === MatchResult.LOSS && secondLineupResult === MatchResult.WIN)
            ) {
                await matchmakingService.updateRatings(interaction.client, match)
                const ratingUpdatedEmbed = new EmbedBuilder()
                    .setColor('#6aa84f')
                    .setTitle('✅ Votes are consistent')
                    .setDescription('Team and Players ratings have been updated !')
                    .setTimestamp()
                const ratingUpdatedMessage = { embeds: [ratingUpdatedEmbed] }
                if (interaction.channelId !== opponentLineup.channelId) {
                    await otherLineupChannel.send(ratingUpdatedMessage)
                }
                await interaction.followUp(ratingUpdatedMessage)

                const channelId = regionService.getRegionData(match.firstLineup.team.region).matchResultsChannelId
                if (channelId) {
                    const [channel] = await handle(interaction.client.channels.fetch(channelId))
                    if (channel instanceof TextChannel) {
                        const matchResultEmbed = new EmbedBuilder()
                            .setTitle(`${match.firstLineup.size}v${match.secondLineup.size}`)
                            .setDescription(`${match.firstLineup.prettyPrintName(TeamLogoDisplay.RIGHT)} ${MatchResultType.toEmoji(match.result.firstLineup.result)} **VS** ${MatchResultType.toEmoji(match.result.secondLineup.result)} ${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)}`)
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
                if (interaction.channelId !== opponentLineup.channelId) {
                    await otherLineupChannel.send(inconsistentVotesMessage)
                }
                await interaction.followUp(inconsistentVotesMessage)
                const firstTeamCaptainUser = await interaction.client.users.fetch(match.result.firstLineup.captainUserId)
                const opponentTeamCaptainUser = await interaction.client.users.fetch(match.result.secondLineup.captainUserId)
                await interaction.channel?.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, firstTeamCaptainUser))
                await otherLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, opponentTeamCaptainUser))
            }
        }
    }
} as IButtonHandler