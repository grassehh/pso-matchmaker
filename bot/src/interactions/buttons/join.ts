import { ButtonInteraction, ComponentType, EmbedBuilder, GuildMember, Interaction, BaseMessageOptions } from "discord.js";
import { DEFAULT_RATING } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineup, IRole, IUser } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { statsService } from "../../services/statsService";
import { ROLE_GOAL_KEEPER, teamService } from "../../services/teamService";
import { userService } from "../../services/userService";
import { handle, notEmpty } from "../../utils";

export default {
    customId: 'join_',
    async execute(interaction: ButtonInteraction) {
        const customId = interaction.customId.split('_')[1]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ Captains are currently picking the teams', ephemeral: true })
            return
        }

        const signedRole = lineup.roles.find(role => role.user?.id == interaction.user.id)
        if (signedRole) {
            if ((signedRole.name.includes('GK') && customId === 'gk') || (!signedRole.name.includes('GK') && customId !== 'gk')) {
                await interaction.reply({ content: '⛔ You are already in the lineup', ephemeral: true })
                return
            }

            lineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id) as ILineup
        }

        await interaction.update({ components: [] })

        let roleToSign
        if (customId === 'gk') {
            roleToSign = lineup.roles.filter(role => role.name.includes('GK')).find(role => !role.user)!
        } else {
            roleToSign = lineup.roles.filter(role => !role.name.includes('GK')).find(role => !role.user)!
        }


        const userToAdd = await userService.findUserByDiscordUserId(interaction.user.id) as IUser
        const stats = await statsService.findPlayerStats(interaction.user.id, lineup.team.region)
        userToAdd.rating = stats ? stats.mixCaptainsRating : DEFAULT_RATING
        userToAdd.emoji = statsService.getLevelEmojiFromMember(interaction.member as GuildMember)

        lineup = await teamService.addUserToLineup(interaction.channelId, roleToSign.name, userToAdd, roleToSign.lineupNumber) as ILineup

        let description = `:inbox_tray: ${interaction.user} has joined the queue !`

        if (await matchmakingService.isNotTeamAndReadyToStart(lineup)) {
            lineup = await teamService.startPicking(lineup.channelId) as ILineup

            const allUserIds = lineup.roles.filter(role => role.type !== ROLE_GOAL_KEEPER).map(role => role.user).filter(notEmpty).map(user => user.id)
            let captainsIds = (await matchmakingService.findTwoMostRelevantCaptains(allUserIds)).map((result: any) => result._id)
            if (captainsIds.length < 2) {
                captainsIds = [allUserIds.splice(Math.floor(Math.random() * allUserIds.length), 1)[0], allUserIds.splice(Math.floor(Math.random() * allUserIds.length), 1)[0]]
            }
            const firstCaptain = await interaction.client.users.fetch(captainsIds[0])
            const secondCaptain = await interaction.client.users.fetch(captainsIds[1])
            const captainNotificationEmbed = new EmbedBuilder()
                .setColor('#6aa84f')
                .setTitle('⚽ You have been chosen as the captain for a mix draft ⚽')
                .setDescription(`Please join the channel ${interaction.channel} to start picking your players !`)
                .setTimestamp()
            await Promise.all([firstCaptain, secondCaptain].map(async user => {
                await handle(user.send({ embeds: [captainNotificationEmbed] }))
            }))
            let currentCaptain = firstCaptain

            description += `\nThe draft begins. The captains are ${firstCaptain} and ${secondCaptain}.\n**${firstCaptain} turn to pick**.`

            let remainingRoles = lineup.roles.filter(role => role.user).map(role => ({
                ...(role as any).toObject() as IRole
            }))
            lineup.roles.forEach(role => role.user = undefined)
            let firstTeamRoles = lineup.roles.filter(role => role.lineupNumber === 1).map(role => ({
                ...(role as any).toObject() as IRole
            }))!
            let secondTeamRoles = lineup.roles.filter(role => role.lineupNumber === 1).map(role => ({
                ...(role as any).toObject() as IRole
            }))
            secondTeamRoles.forEach(role => role.lineupNumber = 2)

            const numberOfGksSigned = remainingRoles.filter(role => role.name.includes('GK') && role.user).length

            const firstCaptainRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user!.id === firstCaptain.id), 1)[0]
            if (firstCaptainRole.name.includes('GK')) {
                firstTeamRoles.find(role => role.name.includes('GK'))!.user = firstCaptainRole.user
            } else {
                firstTeamRoles.find(role => !role.user)!.user = firstCaptainRole.user
            }
            const secondCaptainRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user!.id === secondCaptain.id), 1)[0]
            if (secondCaptainRole.name.includes('GK')) {
                secondTeamRoles.find(role => role.name.includes('GK'))!.user = secondCaptainRole.user
            } else {
                secondTeamRoles.find(role => !role.user)!.user = secondCaptainRole.user
            }

            if (numberOfGksSigned === 2) {
                if (firstCaptainRole.name.includes('GK') && !secondCaptainRole.name.includes('GK')) {
                    secondTeamRoles.find(role => role.name.includes('GK'))!.user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 1)[0].user
                } else if (secondCaptainRole.name.includes('GK') && !firstCaptainRole.name.includes('GK')) {
                    firstTeamRoles.find(role => role.name.includes('GK'))!.user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 1)[0].user
                }
            } else if (numberOfGksSigned === 1 && !firstCaptainRole.name.includes('GK') && !secondCaptainRole.name.includes('GK')) {
                firstTeamRoles.find(role => role.name.includes('GK'))!.user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 2)[0].user
            }

            lineup.roles = firstTeamRoles.concat(secondTeamRoles)

            let reply = await interactionUtils.createReplyForLineup(lineup) as BaseMessageOptions
            const embed = interactionUtils.createInformationEmbed(description, interaction.user)
            reply.embeds = reply.embeds!.concat(embed)
            reply.components = interactionUtils.createCaptainsPickComponent(remainingRoles)
            await interaction.channel?.send(reply)

            const filter = (interaction: ButtonInteraction) => interaction.customId.startsWith('pick_') ? true : false;
            const collector = interaction.channel!.createMessageComponentCollector<ComponentType.Button>({ filter, time: 150000 })
            let roundNumber = 1
            collector.on('collect', async (i: Interaction) => {
                if (!(i instanceof ButtonInteraction)) {
                    return
                }

                if (i.user.id !== currentCaptain.id) {
                    await i.reply({ content: "You are not the captain or it's not your turn to pick !", ephemeral: true })
                    return
                }

                collector.resetTimer()
                const pickedUserId = i.customId.split('_')[1]
                const pickedRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user!.id === pickedUserId), 1)[0]
                let teamRoles = currentCaptain.id === firstCaptain.id ? firstTeamRoles : secondTeamRoles
                if (pickedRole.name.includes('GK')) {
                    teamRoles.find(role => role.name.includes('GK'))!.user = pickedRole.user
                    const otherTeamRoles = currentCaptain.id === firstCaptain.id ? secondTeamRoles : firstTeamRoles
                    const lastGkIndex = remainingRoles.findIndex(role => role.name.includes('GK'))
                    if (lastGkIndex >= 0) {
                        const remainingGkRole = remainingRoles.splice(lastGkIndex, 1)[0]
                        otherTeamRoles.find(role => role.name.includes('GK'))!.user = remainingGkRole.user
                    }
                } else {
                    teamRoles.find(role => !role.user)!.user = pickedRole.user
                }

                lineup = lineup as ILineup
                lineup.roles = firstTeamRoles.concat(secondTeamRoles)

                if (remainingRoles.length <= 1 || teamRoles.filter(role => role.user).length === teamRoles.length || (teamRoles.filter(role => role.user).length === teamRoles.length - 1 && teamRoles.find(role => !role.user)!.name.includes('GK'))) {
                    teamRoles = currentCaptain.id === firstCaptain.id ? secondTeamRoles : firstTeamRoles
                    for (let remainingRole of remainingRoles) {
                        if (remainingRole.name.includes('GK')) {
                            teamRoles.find(role => role.name.includes('GK'))!.user = remainingRole.user
                        } else {
                            teamRoles.find(role => !role.user)!.user = remainingRole.user
                        }
                        lineup.roles = firstTeamRoles.concat(secondTeamRoles)
                    }
                    remainingRoles = []
                    await handle(i.update({ components: [] }))
                    const embed = interactionUtils.createInformationEmbed(`${i.user} has picked ${pickedRole.user!.name}.\nEvery players have been picked. The match is about to start.`, interaction.user)
                    await interaction.followUp({ embeds: [embed] })
                    await matchmakingService.readyMatch(interaction.client, interaction, undefined, lineup)
                    collector.stop()
                    return
                }

                if (roundNumber !== 2) {
                    currentCaptain = currentCaptain.id === firstCaptain.id ? secondCaptain : firstCaptain
                }

                const embed = interactionUtils.createInformationEmbed(`${i.user} has picked ${pickedRole.user!.name}.\n**${currentCaptain} turn to pick.**`, interaction.user)
                let reply = await interactionUtils.createReplyForLineup(lineup)
                reply.embeds = reply.embeds!.concat(embed)
                reply.components = interactionUtils.createCaptainsPickComponent(remainingRoles)
                await i.update({ components: [] })
                await interaction.followUp(reply)
                roundNumber++
            })
            collector.on('end', async () => {
                lineup = lineup as ILineup
                await teamService.stopPicking(lineup.channelId)
                if (remainingRoles.length > 0) {
                    lineup = await teamService.removeUserFromLineup(interaction.channelId, currentCaptain.id) as ILineup
                    let reply = await interactionUtils.createReplyForLineup(lineup)
                    reply.content = `You have been too long to pick a player. Draft has been cancelled and ${currentCaptain} has been removed from the lineup`
                    await interaction.followUp(reply)
                    return
                }
            })
            return
        }

        const embed = interactionUtils.createInformationEmbed(description, interaction.user)
        let reply = await interactionUtils.createReplyForLineup(lineup) as BaseMessageOptions
        reply.embeds = reply.embeds!.concat(embed)
        await interaction.channel?.send(reply)
    }
} as IButtonHandler