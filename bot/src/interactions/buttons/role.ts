import { ButtonInteraction, GuildMember, BaseMessageOptions } from "discord.js";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { statsService } from "../../services/statsService";
import { teamService } from "../../services/teamService";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineup, IUser } from "../../mongoSchema";
import { userService } from "../../services/userService";
import { DEFAULT_RATING } from "../../constants";

export default {
    customId: 'role_',
    async execute(interaction: ButtonInteraction) {
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.allowRanked) {
            const latestMatch = await matchmakingService.findLatestRankedMatch(interaction.user.id)
            if (latestMatch && !latestMatch.result?.isVoted() && Date.now() - latestMatch.schedule.getTime() < 1800000) {
                await interaction.reply({ content: '⛔ Your previous ranked match has not be voted yet and is too recent', ephemeral: true })
                return
            }
        }

        const split = interaction.customId.split('_')
        const selectedRoleName = split[1]
        const lineupNumber = parseInt(split[2])
        const selectedRole = lineup.roles.filter(role => role.lineupNumber === lineupNumber).find(role => role.name == selectedRoleName)!

        if (selectedRole.user) {
            await interaction.reply({ content: '⛔ A player is already signed at this position', ephemeral: true })
            return
        }

        const roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)
        const benchRoleLeft = lineup.bench.find(role => role.user?.id === interaction.user.id)
        if (roleLeft || benchRoleLeft) {
            await Promise.all([
                teamService.removeUserFromLineup(interaction.channelId, interaction.user.id),
                matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)
            ])
        }

        let description = ''
        if (roleLeft) {
            if (lineup.isAnonymous()) {
                description = ':outbox_tray::inbox_tray: A player swapped position'
            } else {
                description = `:outbox_tray::inbox_tray: ${interaction.user} swapped **${roleLeft.name}** with **${selectedRoleName}**`
            }
            const benchUserToTransfer = teamService.getBenchUserToTransfer(lineup, roleLeft)
            if (benchUserToTransfer !== null) {
                lineup = await teamService.moveUserFromBenchToLineup(interaction.channelId, benchUserToTransfer, roleLeft!!) as ILineup
                if (lineup.isAnonymous()) {
                    description += '\n:inbox_tray: A player came off the bench and joined the queue'
                } else {
                    description += `\n:inbox_tray: ${benchUserToTransfer.mention} came off the bench and joined the **${roleLeft?.name}** position`
                }
            }
        } else if (benchRoleLeft) {
            if (lineup.isAnonymous()) {
                description += '\n:inbox_tray: A player came off the bench and joined the queue'
            } else {
                description += `\n:inbox_tray: ${benchRoleLeft!.user.mention} came off the bench and joined the **${selectedRoleName}** position`
            }
        } else {
            if (lineup.isAnonymous()) {
                description = ':inbox_tray: A player joined the queue'
            } else {
                description = `:inbox_tray: ${interaction.user} signed as **${selectedRoleName}**`
            }
        }

        const userToAdd = await userService.findUserByDiscordUserId(interaction.user.id) as IUser
        const playerStats = await statsService.findPlayerStats(interaction.user.id, lineup.team.region)
        userToAdd.rating = playerStats ? playerStats.rating : DEFAULT_RATING
        userToAdd.emoji = statsService.getLevelEmojiFromMember(interaction.member as GuildMember)

        await Promise.all([
            lineup = await teamService.addUserToLineup(interaction.channelId, selectedRoleName, userToAdd, lineupNumber) as ILineup,
            matchmakingService.addUserToLineupQueue(interaction.channelId, selectedRoleName, userToAdd, lineupNumber)
        ])

        if (await matchmakingService.isNotTeamAndReadyToStart(lineup)) {
            await interaction.deferReply()
            const embed = interactionUtils.createInformationEmbed(description, interaction.user)
            const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId) || undefined
            const secondLineup = challenge ?
                (await teamService.retrieveLineup(
                    challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId
                ) || undefined
                ) : undefined
            const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction.client, lineup, secondLineup)
            if (duplicatedUsersReply) {
                duplicatedUsersReply.embeds?.splice(0, 0, embed)
                await interaction.editReply(duplicatedUsersReply)
                return
            }

            await matchmakingService.readyMatch(interaction.client, interaction, challenge, lineup)
            await interaction.editReply({ embeds: [embed] })
            return
        }

        await interaction.update({ components: [] })

        const autoSearchResult = await matchmakingService.checkIfAutoSearch(interaction.client, interaction.user, lineup)
        if (autoSearchResult.joinedQueue) {
            description += `\nYour lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
        }
        if (autoSearchResult.leftQueue) {
            description += `\nYou are no longer searching for a team.`
        }
        if (autoSearchResult.cancelledChallenge) {
            description += `\nThe challenge request has been cancelled.`
        }

        let reply = await interactionUtils.createReplyForLineup(lineup, autoSearchResult.updatedLineupQueue) as BaseMessageOptions
        const informationEmbed = interactionUtils.createInformationEmbed(description, lineup.isAnonymous() ? undefined : interaction.user)
        reply.embeds = (reply.embeds || []).concat(informationEmbed)
        await interaction.channel?.send(reply)
    }
} as IButtonHandler