import { ButtonInteraction, GuildMember, MessageOptions } from "discord.js";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { statsService } from "../../services/statsService";
import { teamService } from "../../services/teamService";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineup } from "../../mongoSchema";

export default {
    customId: 'role_',
    async execute(interaction: ButtonInteraction) {
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const split = interaction.customId.split('_')
        const selectedRoleName = split[1]
        const lineupNumber = parseInt(split[2])
        const selectedRole = lineup.roles.filter(role => role.lineupNumber === lineupNumber).find(role => role.name == selectedRoleName)!

        if (selectedRole.user) {
            await interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
            return
        }

        let promises = []

        let description = `:inbox_tray: ${interaction.user} signed as **${selectedRoleName}**`
        // const roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)
        // const benchRoleLeft = lineup.bench.find(role => role.user?.id === interaction.user.id)
        // if (roleLeft || benchRoleLeft) {
        //     promises.push(teamService.removeUserFromLineup(interaction.channelId, interaction.user.id))
        //     promises.push(matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id))
        //     if (roleLeft) {
        //         description = `:outbox_tray::inbox_tray: ${interaction.user} swapped **${roleLeft.name}** with **${selectedRoleName}**`                
        //         const benchUserToTransfer = teamService.getBenchUserToTransfer(lineup, roleLeft)
        //         if (benchUserToTransfer !== null) {
        //             lineup = await teamService.moveUserFromBenchToLineup(interaction.channelId, benchUserToTransfer, roleLeft!!) as ILineup
        //             description += `\n:inbox_tray: ${benchUserToTransfer.mention} came off the bench and joined the **${roleLeft?.name}** position.`
        //         }
        //     } else {
        //         description = `\n:inbox_tray: ${benchRoleLeft?.user!!.mention} came off the bench and joined the **${selectedRoleName}** position.`
        //     }
        //     await Promise.all(promises)
        //     promises = []
        // }

        const rating = await statsService.findUserStats(interaction.user.id, lineup.team.region)
        const userToAdd = {
            id: interaction.user.id,
            name: interaction.user.username,
            mention: interaction.user.toString(),
            emoji: statsService.getLevelEmojiFromMember(interaction.member as GuildMember),
            rating: rating?.getRating(selectedRole?.type)
        }
        promises.push(lineup = await teamService.addUserToLineup(interaction.channelId, selectedRoleName, userToAdd, lineupNumber) as ILineup)
        promises.push(matchmakingService.addUserToLineupQueue(interaction.channelId, selectedRoleName, userToAdd, lineupNumber))

        if (await matchmakingService.isMixOrCaptainsReadyToStart(lineup)) {
            await interaction.deferReply()
            const embed = interactionUtils.createInformationEmbed(interaction.user, description)
            const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId) || undefined
            const secondLineup = challenge ?
                (await teamService.retrieveLineup(
                    challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId
                ) || undefined
                ) : undefined
            const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)
            if (duplicatedUsersReply) {
                duplicatedUsersReply.embeds?.splice(0, 0, embed)
                await interaction.editReply(duplicatedUsersReply)
                return
            }

            await matchmakingService.readyMatch(interaction, challenge, lineup)
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

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, autoSearchResult.updatedLineupQueue) as MessageOptions
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, description)
        reply.embeds = (reply.embeds || []).concat(informationEmbed)
        await interaction.channel?.send(reply)
    }
} as IButtonHandler