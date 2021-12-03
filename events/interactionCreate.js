const { LineupQueue, Challenge } = require("../mongoSchema");
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const authorizationService = require("../services/authorizationService");

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
                let team = await teamService.findTeamByGuildId(interaction.guildId)
                let lineup = await teamService.retrieveLineup(team, interaction.channelId)

                if (interaction.customId.startsWith("role_")) {
                    let roleName = interaction.customId.substring(5)
                    let selectedRole = lineup.roles.find(role => role.name == roleName)

                    if (selectedRole.user) {
                        await interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
                        return
                    }

                    await matchmakingService.removeUserFromChallenge(interaction.guildId, interaction.channelId, interaction.user.id)
                    await teamService.removeUserFromLineup(interaction.guildId, interaction.channelId, interaction.user.id)
                    await teamService.removeUserFromLineupQueue(interaction.guildId, interaction.channelId, interaction.user.id)
                    let userToAdd = {
                        id: interaction.user.id,
                        name: interaction.user.username,
                        mention: interaction.user.toString()
                    }
                    await matchmakingService.addUserToChallenge(interaction.guildId, interaction.channelId, roleName, userToAdd)
                    await teamService.addUserToLineup(interaction.guildId, interaction.channelId, roleName, userToAdd)
                    await teamService.addUserToLineupQueue(interaction.guildId, interaction.channelId, roleName, userToAdd)

                    await interaction.message.edit({ components: [] })

                    lineup = await teamService.findLineupByChannelId(interaction.guildId, interaction.channelId)
                    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
                    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
                    if (lineup.autoSearch === true && (numberOfPlayersSigned == lineup.roles.length || (numberOfPlayersSigned == lineup.size - 1 && missingRoleName === 'GK'))) {
                        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
                        if (!lineupQueue) {
                            matchmakingService.joinQueue(interaction, team, lineup).then(interaction.reply(`Player ${interaction.user} signed into the lineup as ${roleName}. Your lineup is full, it is now searching for a ${lineup.size}v${lineup.size} team !`))
                            return
                        }
                    }

                    await interaction.reply({ content: `Player ${interaction.user} signed into the lineup as ${roleName}`, components: interactionUtils.createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId === 'leaveLineup') {
                    let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)

                    if (!existingPlayerRole) {
                        await interaction.reply({ content: `❌ You are not in the lineup`, ephemeral: true })
                        return
                    }

                    await matchmakingService.removeUserFromChallenge(interaction.guildId, interaction.channelId, interaction.user.id)
                    await teamService.removeUserFromLineup(interaction.guildId, interaction.channelId, interaction.user.id)
                    await teamService.removeUserFromLineupQueue(interaction.guildId, interaction.channelId, interaction.user.id)
                    await interaction.message.edit({ components: [] })

                    lineup = await teamService.findLineupByChannelId(interaction.guildId, interaction.channelId)

                    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
                    let numberOfMissingPlayers = lineup.size - numberOfPlayersSigned
                    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
                    if (lineup.autoSearch === true && (numberOfMissingPlayers >= 2 || (numberOfMissingPlayers == 1 && missingRoleName !== 'GK'))) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await LineupQueue.deleteOne({ 'lineup.channelId': interaction.channelId })
                            await interaction.reply({ content: `Player ${interaction.user} left the ${existingPlayerRole.name} position. Your team is no longer in the queue !`, components: interactionUtils.createLineupComponents(lineup, interaction.user.id) })
                            return
                        }
                    }

                    await interaction.reply({ content: `Player ${interaction.user} left the ${existingPlayerRole.name} position`, components: interactionUtils.createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId.startsWith('challenge_')) {
                    let lineupQueueId = interaction.customId.substring(10);
                    let lineupQueueToChallenge = await matchmakingService.reserveAndGetLineupQueueById(lineupQueueId)

                    if (!lineupQueueToChallenge) {
                        interaction.reply({ content: "❌ This team is no longer challenging", ephemeral: true })
                        return
                    }

                    let challenge = await matchmakingService.findChallengeByGuildId(lineupQueueToChallenge.team.guildId)
                    if (challenge) {
                        interaction.reply({ content: "❌ This team is negociating a challenge", ephemeral: true })
                        return
                    }

                    let lineupQueue = await matchmakingService.reserveAndGetLineupQueueByChannelId(interaction.channelId)
                    if (!lineupQueue) {
                        lineupQueue = new LineupQueue({
                            team: {
                                guildId: team.guildId,
                                name: team.name,
                                region: team.region
                            },
                            lineup: lineup
                        })
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

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(interactionUtils.createCancelChallengeReply(challenge))
                    let initiatingMessage = await interaction.fetchReply()
                    challenge.initiatingMessageId = initiatingMessage.id

                    let channel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    let challengedMessage = await channel.send(interactionUtils.createDecideChallengeReply(interaction, challenge))
                    challenge.challengedMessageId = challengedMessage.id

                    await challenge.save()
                    return
                }

                if (interaction.customId.startsWith('accept_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    let challengedTeamUsers = challenge.challengedTeam.lineup.roles.map(role => role.user).filter(user => user)
                    let initiatingTeamUsers = challenge.initiatingTeam.lineup.roles.map(role => role.user).filter(user => user)
                    let allUsers = challengedTeamUsers.concat(initiatingTeamUsers)
                    let lobbyName = Math.floor(Math.random() * 1000) + 1000
                    let lobbyPassword = Math.random().toString(36).slice(-4)
                    for (let user of allUsers) {
                        let discordUser = await interaction.client.users.fetch(user.id)
                        discordUser.send(`Match is ready ! Join the custom lobby Lobby **${lobbyName}**. The password is **${lobbyPassword}**`)
                    }

                    await teamService.clearLineup(interaction.guildId, interaction.channelId)
                    await teamService.clearLineup(challenge.initiatingTeam.team.guildId, challenge.initiatingTeam.lineup.channelId)
                    await LineupQueue.deleteOne({ '_id': challenge.challengedTeam.id })
                    await LineupQueue.deleteOne({ '_id': challenge.initiatingTeam.id })
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let initiatingTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, challenge.initiatingTeam.lineup, challenge.challengedTeam.team, challenge.challengedTeam.lineup)
                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    initiatingTeamChannel.send({
                        content: `⚽ The team '${teamService.formatTeamName(challenge.challengedTeam.team, challenge.challengedTeam.lineup)}'' has accepted your challenge request ! Check your private messages for lobby info !`,
                        embeds: [initiatingTeamNextMatchEmbed]
                    })

                    let challengedTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, challenge.challengedTeam.lineup, challenge.initiatingTeam.team, challenge.initiatingTeam.lineup)
                    await interaction.message.edit({ components: [] })
                    await interaction.reply({
                        content: `⚽ You have accepted to challenge the team '${teamService.formatTeamName(challenge.initiatingTeam.team, challenge.initiatingTeam.lineup)}' ! Check your private messages for lobby info !`,
                        embeds: [challengedTeamNextMatchEmbed]
                    })

                    await statsService.incrementGamesPlayed(challenge.challengedTeam.team.guildId, challengedTeamUsers)
                    await statsService.incrementGamesPlayed(challenge.initiatingTeam.team.guildId, initiatingTeamUsers)

                    return
                }

                if (interaction.customId.startsWith('refuse_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    await matchmakingService.freeLineupQueueById(challenge.challengedTeam.id)
                    await matchmakingService.freeLineupQueueById(challenge.initiatingTeam.id)
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    await initiatingTeamChannel.send(`The team '${teamService.formatTeamName(challenge.challengedTeam.team, challenge.challengedTeam.lineup)}' has refused your challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`You have refused to challenge the team '${teamService.formatTeamName(challenge.initiatingTeam.team, challenge.initiatingTeam.lineup)}''`)
                    return
                }

                if (interaction.customId.startsWith('cancel_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    await matchmakingService.freeLineupQueueById(challenge.challengedTeam.id)
                    await matchmakingService.freeLineupQueueById(challenge.initiatingTeam.id)
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
                    await challengedTeamChannel.send(`The team '${challenge.initiatingTeam.team.name}' has cancelled the challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`You have cancelled your challenge request for the team '${teamService.formatTeamName(challenge.challengedTeam.team, challenge.challengedTeam.lineup)}'`)
                    return
                }

                if (interaction.customId.startsWith('delete_team_yes_')) {
                    await matchmakingService.deleteChallengesByGuildId(interaction.guildId)
                    matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId)
                    await teamService.deleteTeam(interaction.guildId)
                    await interaction.reply({ content: '✅ Your team has been deleted', ephemeral: true })
                    return
                }

                if (interaction.customId.startsWith('delete_team_no_')) {
                    await interaction.reply({ content: 'Easy peasy ! Nothing has been deleted', ephemeral: true })
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