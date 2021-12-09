const { LineupQueue, Challenge } = require("../mongoSchema");
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const authorizationService = require("../services/authorizationService");
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING, MERC_USER_ID } = require("../constants");
const { handle } = require("../utils");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!authorizationService.isBotAllowed(interaction)) {
            await interaction.reply({ content: '⛔ Please add me to this channel before using any command (I need  SEND_MESSAGES and VIEW_CHANNEL permissions)', ephemeral: true })
            return
        }


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
                    if (!lineup) {
                        await interactionUtils.replyLineupNotSetup(interaction)
                        return
                    }

                    let roleSigned = interaction.customId.substring(5)
                    let selectedRole = lineup.roles.find(role => role.name == roleSigned)
                    let roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)

                    if (selectedRole.user) {
                        await interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
                        return
                    }

                    await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
                    await matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)
                    let userToAdd = {
                        id: interaction.user.id,
                        name: interaction.user.username
                    }
                    lineup = await teamService.addUserToLineup(interaction.channelId, roleSigned, userToAdd)
                    let lineupQueue = await matchmakingService.addUserToLineupQueue(interaction.channelId, roleSigned, userToAdd)

                    let messageContent = `Player ${interaction.user} signed as **${roleSigned}**`

                    if (roleLeft) {
                        messageContent = `Player ${interaction.user} swapped **${roleLeft.name}** with **${roleSigned}**`
                    }

                    if (lineup.autoSearch === true && matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
                        if (!lineupQueue) {
                            lineupQueue = await matchmakingService.joinQueue(interaction, lineup)
                            messageContent += `. Your lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
                        }
                    } else if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await matchmakingService.leaveQueue(interaction.client, lineupQueue)
                            lineupQueue = null
                            messageContent += `. Your team has been removed from the **${lineup.size}v${lineup.size}** queue !`
                        }
                    }

                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send({ content: messageContent, components: interactionUtils.createLineupComponents(lineup, lineupQueue) })
                    return
                }

                if (interaction.customId === 'addMerc') {
                    let lineup = await teamService.retrieveLineup(interaction.channelId)

                    const mercRoleSelectMenu = new MessageSelectMenu()
                        .setCustomId(`addMerc_select`)
                        .setPlaceholder('Select a position')

                    const availableRoles = lineup.roles.filter(role => !role.user)
                    for (let role of availableRoles) {
                        mercRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
                    }

                    await interaction.reply({ content: 'Which position do you want to sign the player on ?', components: [new MessageActionRow().addComponents(mercRoleSelectMenu)], ephemeral: true })
                    return
                }

                if (interaction.customId === 'clearRole') {
                    let lineup = await teamService.retrieveLineup(interaction.channelId)

                    const clearRoleSelectMenu = new MessageSelectMenu()
                        .setCustomId(`clearRole_select`)
                        .setPlaceholder('Select a position')

                    const takenRoles = lineup.roles.filter(role => role.user)
                    for (let role of takenRoles) {
                        clearRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
                    }

                    await interaction.reply({ content: 'Select the position you want to clear', components: [new MessageActionRow().addComponents(clearRoleSelectMenu)], ephemeral: true })
                    return
                }

                if (interaction.customId === 'leaveLineup') {
                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    let roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)

                    if (!roleLeft) {
                        await interaction.reply({ content: `❌ You are not in the lineup`, ephemeral: true })
                        return
                    }

                    lineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
                    let lineupQueue = await matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)

                    let messageContent = `Player ${interaction.user} left the **${roleLeft.name}** position`

                    if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await matchmakingService.leaveQueue(interaction.client, lineupQueue)
                            lineupQueue = null
                            messageContent += `. Your team has been removed from the **${lineup.size}v${lineup.size}** queue !`
                        }
                    }

                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send({ content: messageContent, components: interactionUtils.createLineupComponents(lineup, lineupQueue) })
                    return
                }

                if (interaction.customId === 'startSearch') {
                    let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
                    if (lineupQueue) {
                        await interactionUtils.replyAlreadyQueued(interaction, lineupQueue.lineup.size)
                        return
                    }
                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!lineup) {
                        await interactionUtils.replyLineupNotSetup(interaction)
                        return
                    }
                    lineupQueue = await matchmakingService.joinQueue(interaction, lineup)
                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send({ content: `🔎 Your team is now searching for a ${lineupQueue.lineup.size}v${lineupQueue.lineup.size} challenge`, components: interactionUtils.createLineupComponents(lineup, lineupQueue) })
                    return
                }

                if (interaction.customId === 'stopSearch') {
                    let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
                    if (!lineupQueue) {
                        await interactionUtils.replyNotQueued(interaction)
                        return
                    }
                    await matchmakingService.leaveQueue(interaction.client, lineupQueue)
                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send({ content: `Your team is no longer searching for a challenge`, components: interactionUtils.createLineupComponents(lineupQueue.lineup) })
                    return
                }

                if (interaction.customId.startsWith('challenge_')) {
                    let lineupQueueIdToChallenge = interaction.customId.substring(10);
                    await interactionUtils.challenge(interaction, lineupQueueIdToChallenge)
                    return
                }

                if (interaction.customId.startsWith('accept_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        await interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }
                    const lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!matchmakingService.isUserAllowedToInteractWithMathmaking(interaction.user.id, lineup)) {
                        await interaction.reply({ content: `⛔ You must be in the lineup in order to accept a challenge`, ephemeral: true })
                        return
                    }

                    if (challenge.initiatingUser.id === interaction.user.id) {
                        await interaction.reply({ content: "⛔ You cannot accept your own challenge request", ephemeral: true })
                        return
                    }

                    await interaction.deferReply()
                    let challengedTeamLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)
                    let challengedTeamUsers = challengedTeamLineup.roles.map(role => role.user).filter(user => user)
                    let initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
                    let initiatingTeamUsers = initiatingTeamLineup.roles.map(role => role.user).filter(user => user)
                    let lobbyName = Math.floor(Math.random() * 1000) + 1000
                    let lobbyPassword = Math.random().toString(36).slice(-4)

                    await matchmakingService.deleteChallengeById(challenge.id)
                    await teamService.clearLineups([interaction.channelId, challenge.initiatingTeam.lineup.channelId])

                    let initiatingUser = await interaction.client.users.fetch(challenge.initiatingUser.id)
                    let lobbyCreationEmbed = new MessageEmbed()
                        .setColor('#6aa84f')
                        .setTitle(`⚽ Challenge accepted ⚽`)
                        .setTimestamp()
                        .addField('Every signed player received the lobby information in private message', `${initiatingUser} is responsible of creating the lobby. If he is not available, then ${interaction.user} is the next responsible player.`)

                    let promises = []
                    promises.push(new Promise(async (resolve, reject) => {
                        let initiatingTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, initiatingTeamLineup, challenge.challengedTeam.lineup, lobbyName, lobbyPassword)
                        let newInitiatingTeamLineup = teamService.createLineup(initiatingTeamLineup.channelId, initiatingTeamLineup.size, initiatingTeamLineup.name, initiatingTeamLineup.autoSearch, initiatingTeamLineup.team)
                        let initiatingTeamLineupComponents = interactionUtils.createLineupComponents(newInitiatingTeamLineup)
                        let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                        await initiatingTeamChannel.send({ embeds: [lobbyCreationEmbed, initiatingTeamNextMatchEmbed], components: initiatingTeamLineupComponents })
                        await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                        await matchmakingService.leaveQueue(interaction.client, challenge.initiatingTeam)
                        resolve()
                    }))
                    promises.push(new Promise(async (resolve, reject) => {
                        let challengedTeamNextMatchEmbed = await interactionUtils.createLineupEmbedForNextMatch(interaction, challengedTeamLineup, initiatingTeamLineup, lobbyName, lobbyPassword)
                        let newChallengedTeamLineup = teamService.createLineup(interaction.channelId, challengedTeamLineup.size, challengedTeamLineup.name, challengedTeamLineup.autoSearch, challengedTeamLineup.team)
                        let challengedTeamLineupComponents = interactionUtils.createLineupComponents(newChallengedTeamLineup)
                        await interaction.editReply({ embeds: [lobbyCreationEmbed, challengedTeamNextMatchEmbed], components: challengedTeamLineupComponents })
                        await interaction.message.edit({ components: [] })
                        await matchmakingService.leaveQueue(interaction.client, challenge.challengedTeam)
                        resolve()
                    }))

                    await Promise.all(promises)

                    if (challenge.challengedTeam.lineup.team.region === 'EU') {
                        await statsService.incrementGamesPlayed(challenge.challengedTeam.lineup.team.guildId, challenge.challengedTeam.lineup.size, challengedTeamUsers)
                        await statsService.incrementGamesPlayed(challenge.initiatingTeam.lineup.team.guildId, challenge.challengedTeam.lineup.size, initiatingTeamUsers)

                        if (challengedTeamLineup.size >= PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING) {
                            await statsService.upgradePlayersLevel(interaction, challengedTeamUsers.map(user => user.id).concat(initiatingTeamUsers.map(user => user.id)))
                        }
                    }
                    return
                }

                if (interaction.customId.startsWith('refuse_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        await interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }

                    if (challenge.initiatingUser.id === interaction.user.id) {
                        await interaction.reply({ content: "⛔ You cannot refuse your own challenge request", ephemeral: true })
                        return
                    }

                    const lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!matchmakingService.isUserAllowedToInteractWithMathmaking(interaction.user.id, lineup)) {
                        await interaction.reply({ content: `⛔ You must be in the lineup in order to refuse a challenge`, ephemeral: true })
                        return
                    }

                    await matchmakingService.deleteChallengeById(challengeId)
                    await matchmakingService.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])

                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    await initiatingTeamChannel.send(`❌ The team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}' has refused your challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send(`❌ ${interaction.user} has refused to challenge the team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}''`)
                    return
                }

                if (interaction.customId.startsWith('cancel_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await matchmakingService.findChallengeById(challengeId)
                    if (!challenge) {
                        await interaction.reply({ content: "❌ This challenge no longer exists", ephemeral: true })
                        return
                    }
                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!matchmakingService.isUserAllowedToInteractWithMathmaking(interaction.user.id, lineup)) {
                        await interaction.reply({ content: `⛔ You must be in the lineup in order to cancel a challenge request`, ephemeral: true })
                        return
                    }

                    await matchmakingService.deleteChallengeById(challenge.id)
                    await matchmakingService.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])

                    let challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
                    await challengedTeamChannel.send(`❌ The team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' has cancelled the challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.channel.send(`❌ ${interaction.user} have cancelled your challenge request for the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`)
                    return
                }

                if (interaction.customId.startsWith('delete_team_yes_')) {
                    await matchmakingService.deleteChallengesByGuildId(interaction.guildId)
                    await matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId)
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
                    let lineupSizes = split[3].split(',').filter(i => i)
                    let page = parseInt(split[4])
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { guildId, page, lineupSizes })
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats, page, lineupSizes }, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_first_page_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[3] === 'true'
                    let lineupSizes = split[4].split(',').filter(i => i)
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { guildId })
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats, page: 0, lineupSizes }, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }


                if (interaction.customId.startsWith('leaderboard_last_page_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[3] === 'true'
                    let lineupSizes = split[4].split(',').filter(i => i)
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { guildId, page: numberOfPages - 1 })
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats, page: numberOfPages - 1, lineupSizes }, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }
            }

            if (interaction.isSelectMenu()) {
                if (interaction.customId.startsWith('stats_type_select_')) {
                    let split = interaction.customId.split('_')
                    let userId = split[3]
                    let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, userId, interaction.values[0] === 'stats_team_value' ? interaction.guildId : null)
                    await interaction.update({ embeds: statsEmbeds })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_type_select')) {
                    let globalStats = interaction.values[0] === 'leaderboard_global_value'
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { guildId })
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats, page: 0, lineupSizes: [] }, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    interaction.message.components[2] = interactionUtils.createLeaderBoardLineupSizeComponent(globalStats)
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }

                if (interaction.customId.startsWith('leaderboard_lineup_size_select_')) {
                    let split = interaction.customId.split('_')
                    let globalStats = split[4] === 'true'
                    let selectedSizes = interaction.values
                    let guildId = globalStats ? null : interaction.guildId
                    let numberOfPlayers = await statsService.countNumberOfPlayers(guildId, selectedSizes)
                    let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
                    let statsEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction = interaction, numberOfPages, { guildId, lineupSizes: selectedSizes })
                    let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats, page: 0, lineupSizes: selectedSizes }, numberOfPages)
                    interaction.message.components[0] = leaderboardPaginationComponent
                    await interaction.update({ embeds: statsEmbeds, components: interaction.message.components })
                    return
                }

                if (interaction.customId === 'addMerc_select') {
                    const selectedMercRole = interaction.values[0]

                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (lineup.roles.find(role => role.name === selectedMercRole).user?.id) {
                        await interaction.reply({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
                        return
                    }

                    const filter = m => interaction.user.id === m.author.id
                    const collector = interaction.channel.createMessageCollector({ filter, time: 10000, max: 1 });
                    collector.on('collect', async m => {
                        let lineup = await teamService.retrieveLineup(interaction.channelId)
                        if (lineup.roles.find(role => role.name === selectedMercRole).user?.id) {
                            await interaction.followUp({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
                            return
                        }

                        let userToAdd
                        let addedPlayerName
                        if (m.mentions.users.size > 0) {
                            const [user] = await handle(interaction.client.users.fetch(m.mentions.users.at(0).id))
                            if (user) {
                                if (user.bot) {
                                    await interaction.followUp({ content: 'Nice try 😉', ephemeral: true })
                                    return
                                }
                                if (lineup.roles.some(role => role.user?.id === user.id)) {
                                    await interaction.followUp({ content: `Player ${m.content} is already signed !`, ephemeral: true })
                                    return
                                }
                                addedPlayerName = user.toString()
                                userToAdd = {
                                    id: user.id,
                                    name: user.username
                                }
                            }
                        } else {
                            addedPlayerName = m.content
                            userToAdd = {
                                id: "merc",
                                name: m.content
                            }
                        }

                        lineup = await teamService.addUserToLineup(interaction.channelId, selectedMercRole, userToAdd)

                        let messageContent = `Player ${interaction.user} manually signed **${addedPlayerName}** as **${selectedMercRole}**`

                        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)

                        if (lineup.autoSearch === true && matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
                            if (!lineupQueue) {
                                lineupQueue = await matchmakingService.joinQueue(interaction, lineup)
                                messageContent += `. Your lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
                            }
                        } else if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                            let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                            if (!challenge) {
                                await matchmakingService.leaveQueue(interaction.client, lineupQueue)
                                lineupQueue = null
                                messageContent += `. Your team has been removed from the **${lineup.size}v${lineup.size}** queue !`
                            }
                        }

                        await interaction.channel.send({ content: messageContent, components: interactionUtils.createLineupComponents(lineup, lineupQueue) })
                    })

                    collector.on('end', async collected => {
                        if (collected.size === 0) {
                            await interaction.followUp({ content: "Sorry, you have taken too long to answer me ...", components: [], ephemeral: true })
                            return
                        }
                    })

                    await interaction.reply({ content: `Type the name of the player you want to sign to the **${selectedMercRole}** position`, components: [], ephemeral: true })
                    return
                }

                if (interaction.customId === 'clearRole_select') {
                    const selectedRoleToClear = interaction.values[0]

                    let lineup = await teamService.retrieveLineup(interaction.channelId)
                    if (!lineup.roles.find(role => role.name === selectedRoleToClear).user) {
                        await interaction.reply({ content: `The ${selectedRoleToClear} is already empty !`, ephemeral: true })
                        return
                    }

                    lineup = await teamService.clearRoleFromLineup(interaction.channelId, selectedRoleToClear)

                    let messageContent = `Player ${interaction.user} cleared the **${selectedRoleToClear}** position`

                    let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)

                    if (lineup.autoSearch === true && matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
                        if (!lineupQueue) {
                            lineupQueue = await matchmakingService.joinQueue(interaction, lineup)
                            messageContent += `. Your lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
                        }
                    } else if (!matchmakingService.isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
                        let challenge = await matchmakingService.findChallengeByGuildId(interaction.guildId)
                        if (!challenge) {
                            await matchmakingService.leaveQueue(interaction.client, lineupQueue)
                            lineupQueue = null
                            messageContent += `. Your team has been removed from the **${lineup.size}v${lineup.size}** queue !`
                        }
                    }

                    await interaction.channel.send({ content: messageContent, components: interactionUtils.createLineupComponents(lineup, lineupQueue) })
                    await interaction.update({ components: [], ephemeral: true })
                    return
                }

                if (interaction.customId === 'challenge_select') {
                    await interactionUtils.challenge(interaction, interaction.values[0])
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