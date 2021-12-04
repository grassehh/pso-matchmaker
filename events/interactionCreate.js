const { LineupQueue, Challenge } = require("../mongoSchema");
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const authorizationService = require("../services/authorizationService");
const { MessageEmbed } = require("discord.js");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;

            if (!authorizationService.isAllowedToExecuteCommand(command, interaction.member)) {
                await interactionUtils.replyNotAllowed(interaction)
                return
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                return
            }
        }

        try {
            if (interaction.isButton()) {
                if (interaction.customId.startsWith("role_")) {
                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    let roleSigned = interaction.customId.substring(5)
                    let selectedRole = lineup.roles.find(role => role.name == roleSigned)

                    if (selectedRole.user) {
                        interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
                        return
                    }

                    await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
                    await matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)
                    let userToAdd = {
                        id: interaction.user.id,
                        name: interaction.user.username,
                        mention: interaction.user.toString()
                    }
                    lineup = await teamService.addUserToLineup(interaction.channelId, roleSigned, userToAdd)
                    let lineupQueue = await matchmakingService.addUserToLineupQueue(interaction.channelId, roleSigned, userToAdd)

                    if (lineup.autoSearch === true && matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
                        if (!lineupQueue) {
                            matchmakingService.joinQueue(interaction, lineup).then(
                                interaction.reply({
                                    content: `Player ${interaction.user} signed into the lineup as ${roleSigned}. Your lineup is full, it is now searching for a ${lineup.size}v${lineup.size} team !`,
                                    components: interactionUtils.createLineupComponents(lineup)
                                })
                            )
                            return
                        }
                    } else if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await matchmakingService.deleteLineupQueueByChannelId(interaction.channelId)
                            interaction.reply({ content: `Player ${interaction.user} swapped his position with ${roleSigned}. Your team is no longer in the queue !`, components: interactionUtils.createLineupComponents(lineup) })
                            return
                        }
                    }

                    interaction.reply({ content: `Player ${interaction.user} signed into the lineup as ${roleSigned}`, components: interactionUtils.createLineupComponents(lineup) })
                    return
                }

                if (interaction.customId === 'leaveLineup') {
                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    let roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)

                    if (!roleLeft) {
                        interaction.reply({ content: `❌ You are not in the lineup`, ephemeral: true })
                        return
                    }

                    lineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
                    let lineupQueue = await matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)

                    if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await matchmakingService.deleteLineupQueueByChannelId(interaction.channelId)
                            interaction.reply({ content: `Player ${interaction.user} left the ${roleLeft.name} position. Your team is no longer in the queue !`, components: interactionUtils.createLineupComponents(lineup) })
                            return
                        }
                    }

                    interaction.reply({ content: `Player ${interaction.user} left the ${roleLeft.name} position`, components: interactionUtils.createLineupComponents(lineup) })
                    return
                }

                if (interaction.customId.startsWith('challenge_')) {
                    let lineupQueueIdToChallenge = interaction.customId.substring(10);

                    let challenge = await matchmakingService.findChallengeByLineupQueueId(lineupQueueIdToChallenge)
                    if (challenge) {
                        interaction.reply({ content: "❌ This team is negociating a challenge", ephemeral: true })
                        return
                    }

                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
                        interaction.reply({ content: '⛔ All outfield positions must be filled before challenging a team', ephemeral: true })
                        return
                    }

                    let lineupQueueToChallenge = await matchmakingService.findLineupQueueById(lineupQueueIdToChallenge)
                    if (!lineupQueueToChallenge) {
                        interaction.reply({ content: "❌ This team is no longer challenging", ephemeral: true })
                        return
                    }

                    if (lineupQueueToChallenge.lineup.size !== lineup.size) {
                        interaction.reply({ content: `❌ Your team is configured for ${lineup.size}v${lineup.size} while the team you are trying to challenge is configured for ${lineupQueueToChallenge.lineup.size}v${lineupQueueToChallenge.lineup.size}. Both teams must have the same size to challenge.`, ephemeral: true })
                        return
                    }

                    let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
                    if (!lineupQueue) {
                        lineupQueue = new LineupQueue({ lineup })
                    }
                    challenge = new Challenge({
                        initiatingUser: {
                            id: interaction.user.id,
                            name: interaction.user.username,
                            mention: interaction.user.toString()
                        },
                        initiatingTeam: lineupQueue,
                        challengedTeam: lineupQueueToChallenge
                    })

                    let challengedTeamUsers = lineupQueueToChallenge.lineup.roles.map(role => role.user).filter(user => user)
                    let initiatingTeamUsers = lineupQueue.lineup.roles.map(role => role.user).filter(user => user)
                    let duplicatedUsers = challengedTeamUsers.filter((user, index, self) =>
                        index === initiatingTeamUsers.findIndex((t) => (
                            t.id === user.id
                        ))
                    )
                    if (duplicatedUsers.length > 0) {
                        let description = 'The following players are signed in both teams. Please arrange with them before challenging: '
                        for (let duplicatedUser of duplicatedUsers) {
                            let discordUser = await interaction.client.users.fetch(duplicatedUser.id)
                            description += discordUser.toString() + ', '
                        }
                        description = description.substring(0, description.length - 2)

                        const duplicatedUsersEmbed = new MessageEmbed()
                            .setColor('#0099ff')
                            .setTitle(`⛔ Some players are signed in both teams !`)
                            .setDescription(description)
                            .setTimestamp()
                            .setFooter(`Author: ${interaction.user.username}`)

                        interaction.reply({ embeds: [duplicatedUsersEmbed] })
                        return
                    }

                    await matchmakingService.reserveLineupQueuesByIds([lineupQueueIdToChallenge, lineupQueue.id])
                    await interaction.message.edit({ components: [] })
                    await interaction.reply(interactionUtils.createCancelChallengeReply(challenge))
                    let initiatingMessage = await interaction.fetchReply()
                    challenge.initiatingMessageId = initiatingMessage.id

                    let channel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    let challengedMessage = await channel.send(interactionUtils.createDecideChallengeReply(interaction, challenge))
                    challenge.challengedMessageId = challengedMessage.id
                    challenge.save()
                    return
                }

                if (interaction.customId.startsWith('accept_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    let initiatingUser = await interaction.client.users.fetch(challenge.initiatingUser.id)


                    let challengedTeamLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)
                    let challengedTeamUsers = challengedTeamLineup.roles.map(role => role.user).filter(user => user)
                    let initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
                    let initiatingTeamUsers = initiatingTeamLineup.roles.map(role => role.user).filter(user => user)
                    let lobbyName = Math.floor(Math.random() * 1000) + 1000
                    let lobbyPassword = Math.random().toString(36).slice(-4)

                    await matchmakingService.deleteChallengeById(challenge.id)
                    await matchmakingService.deleteLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])
                    await teamService.clearLineups([interaction.channelId, challenge.initiatingTeam.lineup.channelId])

                    let lobbyCreationEmbed = new MessageEmbed()
                        .setColor('#6aa84f')
                        .setTitle(`⚽ Challenge accepted ⚽`)
                        .setTimestamp()
                        .addField('Every signed player received the lobby information in private message', `${initiatingUser} is responsible of creating the lobby. If he is not available, then ${interaction.user} is the next responsible player.`)

                    let initiatingTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, initiatingTeamLineup, challenge.challengedTeam.lineup, lobbyName, lobbyPassword)
                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    initiatingTeamChannel.send({ embeds: [lobbyCreationEmbed, initiatingTeamNextMatchEmbed] })

                    let challengedTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, challengedTeamLineup, initiatingTeamLineup, lobbyName, lobbyPassword)
                    await interaction.message.edit({ components: [] })
                    await interaction.reply({ embeds: [lobbyCreationEmbed, challengedTeamNextMatchEmbed] })

                    await statsService.incrementGamesPlayed(challenge.challengedTeam.lineup.team.guildId, challengedTeamUsers)
                    await statsService.incrementGamesPlayed(challenge.initiatingTeam.lineup.team.guildId, initiatingTeamUsers)

                    return
                }

                if (interaction.customId.startsWith('refuse_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    await matchmakingService.deleteChallengeById(challengeId)
                    await matchmakingService.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])

                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    await initiatingTeamChannel.send(`❌ The team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}' has refused your challenge request`)

                    await interaction.message.edit({ components: [] })
                    interaction.reply(`❌ You have refused to challenge the team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}''`)
                    return
                }

                if (interaction.customId.startsWith('cancel_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    await matchmakingService.deleteChallengeById(challenge.id)
                    await matchmakingService.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])

                    let challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
                    await challengedTeamChannel.send(`❌ The team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' has cancelled the challenge request`)

                    await interaction.message.edit({ components: [] })
                    interaction.reply(`❌ You have cancelled your challenge request for the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`)
                    return
                }

                if (interaction.customId.startsWith('delete_team_yes_')) {
                    await matchmakingService.deleteChallengesByGuildId(interaction.guildId)
                    await matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId)
                    await teamService.deleteTeam(interaction.guildId)
                    interaction.reply({ content: '✅ Your team has been deleted', ephemeral: true })
                    return
                }

                if (interaction.customId.startsWith('delete_team_no_')) {
                    interaction.reply({ content: 'Easy peasy ! Nothing has been deleted', ephemeral: true })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_page_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[2] === 'true'
                    let page = parseInt(split[3])
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, guildId, page, numberOfPages)
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent(globalStats, page, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_first_page_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[3] === 'true'
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, guildId, 0, numberOfPages)
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent(globalStats, 0, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }


                if (interaction.customId.startsWith('leaderboard_last_page_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[3] === 'true'
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, guildId, numberOfPages, numberOfPages)
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent(globalStats, numberOfPages, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }
            }

            if (interaction.isSelectMenu()) {
                if (interaction.customId.startsWith('stats_global_select_')) {
                    let userId = interaction.customId.substring(20)
                    let user = await interaction.client.users.resolve(userId)
                    let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, user, interaction.values[0] === 'stats_team_value' ? interaction.guildId : null)
                    await interaction.update({ embeds: statsEmbeds })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_global_select')) {
                    let globalStats = interaction.values[0] === 'leaderboard_global_value'
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, guildId, 0, numberOfPages)
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent(true, 0, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }
            }
        }
        catch (error) {
            console.error(error);
            try {
                await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
            } catch (error) {
                //Shush
            }
        }
    }
}