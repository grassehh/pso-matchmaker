const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");
const statsService = require("../../services/statsService");
const { handle } = require("../../utils");
const { MessageEmbed } = require("discord.js");

module.exports = {
    customId: 'join_',
    async execute(interaction) {
        const customId = interaction.customId.split('_')[1]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ Captains are currently picking the teams', ephemeral: true })
            return
        }

        const signedRole = lineup.roles.filter(role => role.user).find(role => role.user.id == interaction.user.id)
        if (signedRole && ((signedRole.name.includes('GK') && customId === 'gk') || (!signedRole.name.includes('GK') && customId !== 'gk'))) {
            await interaction.reply({ content: '⛔ You are already in the lineup', ephemeral: true })
            return
        }

        const newLineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
        if (newLineup) {
            lineup = newLineup
        }

        let roleToSign
        if (customId === 'gk') {
            roleToSign = lineup.roles.filter(role => role.name.includes('GK')).find(role => !role.user)
        } else {
            roleToSign = lineup.roles.filter(role => !role.name.includes('GK')).find(role => !role.user)
        }

        const userToAdd = {
            id: interaction.user.id,
            name: interaction.user.username,
            emoji: statsService.getLevelEmojiFromMember(interaction.member)
        }

        lineup = await teamService.addUserToLineup(interaction.channelId, roleToSign.name, userToAdd, roleToSign.lineupNumber)

        let description = `:inbox_tray: ${interaction.user} has joined the queue !`

        if (await matchmakingService.isMixOrCaptainsReadyToStart(lineup)) {
            lineup = await teamService.startPicking(lineup.channelId)

            const allUserIds = lineup.roles.filter(role => role.user).map(role => role.user.id)
            let captainsIds = (await matchmakingService.findTwoMostRelevantCaptainsIds(allUserIds)).map(result => result._id)
            if (captainsIds.length < 2) {
                captainsIds = [allUserIds.splice(Math.floor(Math.random() * allUserIds.length), 1)[0], allUserIds.splice(Math.floor(Math.random() * allUserIds.length), 1)[0]]
            }
            const firstCaptain = await interaction.client.users.fetch(captainsIds[0])
            const secondCaptain = await interaction.client.users.fetch(captainsIds[1])
            const captainNotificationEmbed = new MessageEmbed()
                .setColor('#6aa84f')
                .setTitle('⚽ You have been chosen as the captain for a mix draft ⚽')
                .setDescription(`Please join the channel ${interaction.channel} to start the draft !`)
                .setTimestamp()
            await Promise.all([firstCaptain, secondCaptain].map(async user => {
                await handle(user.send({ embeds: [captainNotificationEmbed] }))
            }))
            let currentCaptain = firstCaptain

            description += `\nThe draft begins. The captains are ${firstCaptain} and ${secondCaptain}.\n**${firstCaptain} turn to pick**.`

            let remainingRoles = lineup.roles.filter(role => role.user).map(role => ({ ...role.toObject() }))
            lineup.roles.forEach(role => role.user = null)
            let firstTeamRoles = lineup.roles.filter(role => role.lineupNumber === 1).map(role => ({ ...role.toObject() }))
            let secondTeamRoles = lineup.roles.filter(role => role.lineupNumber === 1).map(role => ({ ...role.toObject() }))
            secondTeamRoles.forEach(role => role.lineupNumber = 2)

            const numberOfGksSigned = remainingRoles.filter(role => role.name.includes('GK') && role.user).length

            const firstCaptainRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user.id === firstCaptain.id), 1)[0]
            if (firstCaptainRole.name.includes('GK')) {
                firstTeamRoles.find(role => role.name.includes('GK')).user = firstCaptainRole.user
            } else {
                firstTeamRoles.find(role => !role.user).user = firstCaptainRole.user
            }
            const secondCaptainRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user.id === secondCaptain.id), 1)[0]
            if (secondCaptainRole.name.includes('GK')) {
                secondTeamRoles.find(role => role.name.includes('GK')).user = secondCaptainRole.user
            } else {
                secondTeamRoles.find(role => !role.user).user = secondCaptainRole.user
            }

            if (numberOfGksSigned === 2) {
                if (firstCaptainRole.name.includes('GK') && !secondCaptainRole.name.includes('GK')) {
                    secondTeamRoles.find(role => role.name.includes('GK')).user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 1)[0].user
                } else if (secondCaptainRole.name.includes('GK') && !firstCaptainRole.name.includes('GK')) {
                    firstTeamRoles.find(role => role.name.includes('GK')).user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 1)[0].user
                }
            } else if (numberOfGksSigned === 1 && !firstCaptainRole.name.includes('GK') && !secondCaptainRole.name.includes('GK')) {
                firstTeamRoles.find(role => role.name.includes('GK')).user = remainingRoles.splice(remainingRoles.findIndex(role => role.name.includes('GK')), 2)[0].user
            }

            lineup.roles = firstTeamRoles.concat(secondTeamRoles)

            let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
            const embed = interactionUtils.createInformationEmbed(interaction.user, description)
            reply.embeds = reply.embeds.concat(embed)
            reply.components = interactionUtils.createCaptainsPickComponent(remainingRoles)
            await interaction.update({ components: [] })
            await interaction.channel.send(reply)

            const filter = (interaction) => interaction.customId.startsWith('pick_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, idle: 138000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== currentCaptain.id) {
                    await i.reply({ content: "You are not the captain or it's not your turn to pick !", ephemeral: true })
                    return
                }
                const pickedUserId = i.customId.split('_')[1]
                const pickedRole = remainingRoles.splice(remainingRoles.findIndex(role => role.user.id === pickedUserId), 1)[0]
                let teamRoles = currentCaptain.id === firstCaptain.id ? firstTeamRoles : secondTeamRoles
                if (pickedRole.name.includes('GK')) {
                    teamRoles.find(role => role.name.includes('GK')).user = pickedRole.user
                    const otherTeamRoles = currentCaptain.id === firstCaptain.id ? secondTeamRoles : firstTeamRoles
                    const lastGkIndex = remainingRoles.findIndex(role => role.name.includes('GK'))
                    if (lastGkIndex >= 0) {
                        const remainingGkRole = remainingRoles.splice(lastGkIndex, 1)[0]
                        otherTeamRoles.find(role => role.name.includes('GK')).user = remainingGkRole.user
                    }
                } else {
                    teamRoles.find(role => !role.user).user = pickedRole.user
                }

                lineup.roles = firstTeamRoles.concat(secondTeamRoles)

                if (remainingRoles.length <= 1 || teamRoles.filter(role => role.user).length === teamRoles.length || (teamRoles.filter(role => role.user).length === teamRoles.length - 1 && teamRoles.find(role => !role.user).name.includes('GK'))) {
                    teamRoles = currentCaptain.id === firstCaptain.id ? secondTeamRoles : firstTeamRoles
                    for (let remainingRole of remainingRoles) {
                        if (remainingRole.name.includes('GK')) {
                            teamRoles.find(role => role.name.includes('GK')).user = remainingRole.user
                        } else {
                            teamRoles.find(role => !role.user).user = remainingRole.user
                        }
                        lineup.roles = firstTeamRoles.concat(secondTeamRoles)
                    }
                    remainingRoles = []
                    await teamService.stopPicking(lineup.channelId)
                    await handle(i.update({ components: [] }))

                    const embed = interactionUtils.createInformationEmbed(interaction.user, `${i.user} has picked ${pickedRole.user.name}.\nEvery players have been picked. The match is about to start.`)
                    await interaction.followUp({ embeds: [embed] })
                    await matchmakingService.readyMatch(interaction, null, lineup)
                    collector.stop()
                    return
                }

                currentCaptain = currentCaptain.id === firstCaptain.id ? secondCaptain : firstCaptain

                const embed = interactionUtils.createInformationEmbed(interaction.user, `${i.user} has picked ${pickedRole.user.name}.\n**${currentCaptain} turn to pick.**`)
                let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
                reply.embeds = reply.embeds.concat(embed)
                reply.components = interactionUtils.createCaptainsPickComponent(remainingRoles)
                await i.update({ components: [] })
                await interaction.followUp(reply)
            })
            collector.on('end', async (collected) => {
                await teamService.stopPicking(lineup.channelId)
                if (remainingRoles.length > 0) {
                    lineup = await teamService.removeUserFromLineup(interaction.channelId, currentCaptain.id)
                    let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
                    reply.content = `You have been too long to pick a player. Draft has been cancelled and ${currentCaptain} has been removed from the lineup`
                    await interaction.followUp(reply)
                    return
                }
            })
            return
        }

        const embed = interactionUtils.createInformationEmbed(interaction.user, description)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
        reply.embeds = reply.embeds.concat(embed)
        await interaction.update({ components: [] })
        await interaction.channel.send(reply)
    }
}