import { BaseGuildTextChannel, ButtonInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineupMatchResult } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService, MatchResult, MatchResultType } from "../../services/matchmakingService";
import { TEAM_REGION_AS, TEAM_REGION_EU, TEAM_REGION_NA, TEAM_REGION_SA } from "../../services/teamService";
import { handle } from "../../utils";

function getMatchResultChanneldIdByRegion(region: string): string | null {
    switch (region) {
        case TEAM_REGION_EU:
            return process.env.PSO_EU_DISCORD_MATCH_RESULTS_CHANNEL_ID as string
        case TEAM_REGION_NA:
            return process.env.PSO_NA_DISCORD_MATCH_RESULTS_CHANNEL_ID as string
        case TEAM_REGION_SA:
            return process.env.PSO_SA_DISCORD_MATCH_RESULTS_CHANNEL_ID as string
        case TEAM_REGION_AS:
            return process.env.PSO_AS_DISCORD_MATCH_RESULTS_CHANNEL_ID as string
        default:
            return null
    }
}

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
        if (match.firstLineup.isMixOrCaptains() && match.secondLineup.isMixOrCaptains()) {
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
            .setFooter({ text: `Author: ${interaction.user}` })
        const voteNotificationMessage = { embeds: [voteNotificationMessageEmbed] }
        if (interaction.channelId !== opponentLineup.channelId) {
            await otherLineupChannel.send(voteNotificationMessage)
        }
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
                if (interaction.channelId !== opponentLineup.channelId) {
                    await otherLineupChannel.send(ratingUpdatedMessage)
                }
                await interaction.followUp(ratingUpdatedMessage)

                const channelId = getMatchResultChanneldIdByRegion(match.firstLineup.team.region)
                if (channelId) {
                    const [channel] = await handle(interaction.client.channels.fetch(channelId))
                    if (channel instanceof TextChannel) {
                        const firstLineupEmoji = MatchResultType.toEmoji(match.result.firstLineup.result)
                        const secondLineupEmoji = MatchResultType.toEmoji(match.result.secondLineup.result)

                        const matchResultEmbed = new EmbedBuilder()
                            .setTitle(`${match.firstLineup.size}v${match.secondLineup.size}`)
                            .addFields([
                                { name: match.firstLineup.team.name, value: `${firstLineupEmoji} ${MatchResultType.toString(match.result.firstLineup.result)} ${firstLineupEmoji}`, inline: true },
                                { name: match.secondLineup.team.name, value: `${secondLineupEmoji} ${MatchResultType.toString(match.result.secondLineup.result)} ${secondLineupEmoji}`, inline: true }
                            ])
                            .setColor('#6aa84f')
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