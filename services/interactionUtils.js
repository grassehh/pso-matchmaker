const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require("discord.js");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const matchmakingService = require("../services/matchmakingService");
const { Stats, LineupQueue, Challenge } = require("../mongoSchema");
const { handle } = require("../utils");

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `❌ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command`,
        ephemeral: true
    })
}

exports.replyNotQueued = async (interaction) => {
    await interaction.reply({
        content: `❌ Your team is not queued for matchmaking`,
        ephemeral: true
    })
}

exports.replyTeamNotRegistered = async (interaction) => {
    await interaction.reply({
        content: '❌ Please register your team with the /register_team command first',
        ephemeral: true
    })
}

exports.replyAlreadyChallenging = async (interaction, challenge) => {
    await interaction.reply({
        content: `❌ Your team is negotiating a challenge between the teams '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' and '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`,
        ephemeral: true
    })
}

exports.replyLineupNotSetup = async (interaction) => {
    await interaction.reply({
        content: '❌ This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
        ephemeral: true
    })
}

exports.createCancelChallengeReply = (interaction, challenge) => {
    let cancelChallengeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`cancel_challenge_${challenge.id}`)
                .setLabel(`Cancel Request`)
                .setStyle('DANGER')
        )

    let message
    if (challenge.challengedTeam.lineup.isMix()) {
        message = `💬 ${interaction.user} is challenging the mix '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'. The match will start automatically once the mix lineup is full.`
    } else {
        message = `💬 ${interaction.user} has sent a challenge request to the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'. You can either wait for their answer, or cancel your request.`
    }
    return { content: message, components: [cancelChallengeRow] }
}

exports.createDecideChallengeReply = (interaction, challenge) => {

    if (challenge.challengedTeam.lineup.isMix()) {
        return createReplyForMixLineup(interaction, challenge.challengedTeam.lineup, challenge.initiatingTeam.lineup)
    } else {
        const challengeEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' is challenging you for a ${challenge.initiatingTeam.lineup.size}v${challenge.initiatingTeam.lineup.size} match !`)
            .setDescription(`Contact ${challenge.initiatingUser.mention} if you want to arrange further.`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        let challengeActionRow = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(`accept_challenge_${challenge.id}`)
                    .setLabel(`Accept`)
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId(`refuse_challenge_${challenge.id}`)
                    .setLabel(`Refuse`)
                    .setStyle('DANGER')
            )
        return { embeds: [challengeEmbed], components: [challengeActionRow] }
    }
}

exports.createReplyForLineup = async (interaction, lineup, lineupQueue) => {
    if (lineup.isMix() || lineup.isPicking) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        let challengingLineup
        if (challenge) {
            challengingLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
        }
        return createReplyForMixLineup(interaction, lineup, challengingLineup)
    }

    if (lineup.isCaptains()) {
        return createReplyForCaptainsLineup(interaction, lineup)
    }

    return createReplyForTeamLineup(lineup, lineupQueue)
}

exports.createCaptainsPickComponent = (roles) => {
    const captainActionsComponents = []
    const allUsers = roles.map(role => role.user).filter(user => user)
    let i = 0
    for (let user of allUsers) {
        if (i % 5 === 0) {
            captainActionsComponents.push(new MessageActionRow())
        }

        let playerName = user.name.substring(0, 60)
        captainActionsComponents[captainActionsComponents.length - 1].addComponents(
            new MessageButton()
                .setCustomId(`pick_${user.id}_${i}`)
                .setLabel(playerName)
                .setStyle('PRIMARY')
        )
        i++
    }

    return captainActionsComponents
}

exports.replyNotAllowed = async (interaction) => {
    await interaction.reply({ content: '❌ You are not allowed to execute this command', ephemeral: true })
}

exports.createStatsEmbeds = async (interaction, userId, guildId) => {
    let user = await interaction.client.users.resolve(userId)
    let stats = await statsService.findStats(userId, guildId)
    if (stats.length === 0) {
        stats = new Stats({
            numberOfGames: 0
        })
    } else {
        stats = stats[0]
    }
    const statsEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`${guildId ? 'Team' : 'Global'} stats`)
        .setTimestamp()
        .setDescription(user.toString())
        .setFooter(`Author: ${interaction.user.username}`)
    statsEmbed.addField('⚽ Games played', stats.numberOfGames.toString())

    return [statsEmbed]
}

exports.createLeaderBoardEmbeds = async (interaction, numberOfPages, searchOptions = {}) => {
    const { guildId, page = 0, pageSize = statsService.DEFAULT_LEADERBOARD_PAGE_SIZE, lineupSizes = [] } = searchOptions
    let allStats = await statsService.findStats(null, guildId, page, pageSize, lineupSizes)
    let statsEmbed
    if (allStats.length === 0) {
        statsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`${guildId ? 'Team' : 'Global'} ⚽ GAMES Leaderboard 🏆`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
            .addField('Ooooof', 'This looks pretty empty here. Time to get some games lads !')
    } else {
        statsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`${guildId ? 'Team' : 'Global'} ⚽ GAMES Leaderboard 🏆`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        let playersStats = ''
        let pos = (pageSize * page) + 1
        for (let stats of allStats) {
            let user = await interaction.client.users.fetch(stats._id)
            if (user) {
                let isLeader = pos === 1 && page === 0
                let isTop3 = pos <= 3
                playersStats += `${isTop3 ? '**' : ''}${pos}. ${isLeader ? '🏆 ' : ''} ${user.username} (${stats.numberOfGames})${isLeader ? ' 🏆' : ''}${isTop3 ? '**' : ''}\n`
                pos++
            }
        }

        statsEmbed.addField(`Page ${page + 1}/${numberOfPages}`, playersStats)
    }

    if (lineupSizes.length > 0) {
        let description = "Selected sizes: "
        for (let lineupSize of lineupSizes) {
            description += `${lineupSize}v${lineupSize}, `
        }
        description = description.substring(0, description.length - 2)
        statsEmbed.setDescription(description)
    }

    return [statsEmbed]
}

exports.createLeaderBoardPaginationComponent = (searchOptions = {}, numberOfPages) => {
    const { globalStats, page, lineupSizes } = searchOptions
    const paginationActionsRow = new MessageActionRow()
    paginationActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaderboard_first_page_${globalStats}_${lineupSizes}`)
            .setLabel('<<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${lineupSizes}_${page - 1}`)
            .setLabel('<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${lineupSizes}_${page + 1}`)
            .setLabel('>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1),
        new MessageButton()
            .setCustomId(`leaderboard_last_page_${globalStats}_${lineupSizes}`)
            .setLabel('>>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1)
    )

    return paginationActionsRow
}

exports.createLineupEmbedsForNextMatch = async (interaction, lineup, opponentLineup, lobbyName, lobbyPassword) => {
    const lineupEmbedsForNextMatch = []
    const firstLineupTeamName = opponentLineup ? teamService.formatTeamName(opponentLineup) : teamService.formatTeamName(lineup) + ' (#2)'
    const firstLineupEmbed = await createLineupEmbed(interaction, lineup.roles.filter(role => role.lineupNumber === 1), firstLineupTeamName, lobbyName, lobbyPassword)
    lineupEmbedsForNextMatch.push(firstLineupEmbed)

    if (!opponentLineup && lineup.isMixOrCaptains()) {
        const secondLineupTeamName = teamService.formatTeamName(lineup) + ' (#1)'
        const secondLineupEmbed = await createLineupEmbed(interaction, lineup.roles.filter(role => role.lineupNumber === 2), secondLineupTeamName, lobbyName, lobbyPassword)
        lineupEmbedsForNextMatch.push(secondLineupEmbed)
    }

    return lineupEmbedsForNextMatch
}

async function createLineupEmbed(interaction, roles, opponentTeamName, lobbyName, lobbyPassword) {
    let lineupEmbed = new MessageEmbed()
        .setColor('#6aa84f')
        .setTitle(`Match lineup against '${opponentTeamName}'`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)
    let promisesForFirstLineup = roles.map(async (role) => {
        if (!role.user) {
            return { role, playerName: '\u200b' }
        }

        let playerName = `${role.user.name}`
        let [discordUser] = await handle(interaction.client.users.fetch(role.user.id))
        if (discordUser) {
            let channelIds = await teamService.findAllLineupChannelIdsByUserId(role.user.id)
            if (channelIds.length > 0) {
                await matchmakingService.removeUserFromAllLineupQueues(role.user.id)
                await teamService.removeUserFromLineupsByChannelIds(role.user.id, channelIds)
                await Promise.all(channelIds.map(async channelId => {
                    await teamService.notifyChannelForUserLeaving(interaction.client, discordUser, channelId, `⚠ Player ${discordUser} has gone to play another match.`)
                }))
            }
            let playerDmEmbed = new MessageEmbed()
                .setColor('#6aa84f')
                .setTitle(`⚽ PSO Match ready ⚽`)
                .setDescription(`Your are playing **${role.name}** against **${opponentTeamName}**`)
                .addField('Lobby name', `**${lobbyName}**`, true)
                .addField('Lobby password', `**${lobbyPassword}**`, true)
                .setTimestamp()
            await handle(discordUser.send({ embeds: [playerDmEmbed] }))
            playerName = discordUser
        }

        return { role, playerName }
    })

    const rolesWithPlayer = await Promise.all(promisesForFirstLineup)
    let description = ''
    rolesWithPlayer.map(roleWithPlayer => {
        description += `**${roleWithPlayer.role.name}:** ${roleWithPlayer.playerName}\n`
    })
    lineupEmbed.setDescription(description)

    return lineupEmbed
}

exports.createLeaderBoardLineupSizeComponent = (globalStats) => {
    return new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId(`leaderboard_lineup_size_select_${globalStats}`)
            .setPlaceholder('Lineup Size')
            .setMinValues(0)
            .setMaxValues(11)
            .addOptions([
                {
                    label: '1v1',
                    value: '1'
                },
                {
                    label: '2v2',
                    value: '2'
                },
                {
                    label: '3v3',
                    value: '3'
                },
                {
                    label: '4v4',
                    value: '4'
                },
                {
                    label: '5v5',
                    value: '5'
                },
                {
                    label: '6v6',
                    value: '6'
                },
                {
                    label: '7v7',
                    value: '7'
                },
                {
                    label: '8v8',
                    value: '8'
                },
                {
                    label: '9v9',
                    value: '9'
                },
                {
                    label: '10v10',
                    value: '10'
                },
                {
                    label: '11v11',
                    value: '11'
                }
            ])
    )
}

exports.challenge = async (interaction, lineupQueueIdToChallenge) => {
    let lineupQueueToChallenge = await matchmakingService.findLineupQueueById(lineupQueueIdToChallenge)
    if (!lineupQueueToChallenge) {
        await interaction.reply({ content: "❌ This team is no longer challenging", ephemeral: true })
        return
    }

    let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
    if (challenge) {
        await this.replyAlreadyChallenging(interaction, challenge)
        return
    }

    challenge = await matchmakingService.findChallengeByChannelId(lineupQueueToChallenge.lineup.channelId)
    if (challenge) {
        await interaction.reply({ content: "❌ This team is negociating a challenge", ephemeral: true })
        return
    }

    let lineup = await teamService.retrieveLineup(interaction.channelId)
    if (!lineup) {
        await this.replyLineupNotSetup(interaction)
        return
    }

    if (!matchmakingService.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
        await interaction.reply({ content: `⛔ You must be in the lineup in order to challenge a team`, ephemeral: true })
        return
    }

    if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
        await interaction.reply({ content: '⛔ All outfield positions must be filled before challenging a team', ephemeral: true })
        return
    }

    if (lineupQueueToChallenge.lineup.size !== lineup.size) {
        await interaction.reply({ content: `❌ Your team is configured for ${lineup.size}v${lineup.size} while the team you are trying to challenge is configured for ${lineupQueueToChallenge.lineup.size}v${lineupQueueToChallenge.lineup.size}. Both teams must have the same size to challenge.`, ephemeral: true })
        return
    }

    if (lineupQueueToChallenge.lineup.isMix()) {
        const allMixUsers = lineupQueueToChallenge.lineup.roles.map(role => role.user).filter(user => user)
        const numberOfMissingPlayers = lineupQueueToChallenge.lineup.size * 2 - allMixUsers.length
        if (numberOfMissingPlayers <= 2) {
            await interaction.reply({ content: 'This mix has too many players signed in both teams, you cannot challenge it right now', ephemeral: true })
            return
        }
    }

    if (await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, lineupQueueToChallenge.lineup)) {
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

    let channel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
    let challengedMessage = await channel.send(this.createDecideChallengeReply(interaction, challenge))
    challenge.challengedMessageId = challengedMessage.id

    await matchmakingService.reserveLineupQueuesByIds([lineupQueueIdToChallenge, lineupQueue.id])
    let initiatingMessage = await interaction.channel.send(this.createCancelChallengeReply(interaction, challenge))
    challenge.initiatingMessageId = initiatingMessage.id

    await challenge.save()

    await interaction.deferUpdate()

    if (await matchmakingService.isMixOrCaptainsReadyToStart(lineupQueueToChallenge.lineup)) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        await matchmakingService.readyMatch(interaction, challenge, lineup)
        return
    }
}

exports.createLineupComponents = createLineupComponents

function createLineupComponents(lineup, lineupQueue, selectedLineupNumber = 1) {
    components = createRolesComponent(lineup, selectedLineupNumber)

    const lineupActionsRow = new MessageActionRow()
    if (!lineup.isMix()) {
        if (lineupQueue) {
            lineupActionsRow.addComponents(
                new MessageButton()
                    .setCustomId(`stopSearch`)
                    .setLabel(`Stop search`)
                    .setStyle('DANGER')
            )
        } else {
            lineupActionsRow.addComponents(
                new MessageButton()
                    .setCustomId(`startSearch`)
                    .setLabel('Search')
                    .setDisabled(!matchmakingService.isLineupAllowedToJoinQueue(lineup))
                    .setStyle('SUCCESS')
            )
        }

        lineupActionsRow.addComponents(
            new MessageButton()
                .setCustomId(`leaveLineup`)
                .setLabel(`Leave`)
                .setStyle('DANGER')
        )
    }

    const numberOfSignedPlayers = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user != null).length
    const numberOfMissingPlayers = lineup.size - numberOfSignedPlayers
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`clearRole_${selectedLineupNumber}`)
            .setLabel("Clear a position")
            .setDisabled(numberOfSignedPlayers === 0)
            .setStyle('SECONDARY')
    )
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`addMerc_${selectedLineupNumber}`)
            .setLabel('Sign another player')
            .setDisabled(numberOfMissingPlayers === 0)
            .setStyle('SECONDARY')
    )
    components.push(lineupActionsRow)

    return components
}

function createRolesComponent(lineup, selectedLineupNumber = 1) {
    let components = []

    const gkActionRow = new MessageActionRow()
    const midfieldersActionRow = new MessageActionRow()
    const attackersActionRow = new MessageActionRow()
    const defendersActionRow = new MessageActionRow()

    const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
    for (let role of roles) {
        let actionRow
        switch (role.type) {
            case teamService.ROLE_GOAL_KEEPER: {
                actionRow = gkActionRow
                break
            }
            case teamService.ROLE_ATTACKER: {
                actionRow = attackersActionRow
                break
            }
            case teamService.ROLE_MIDFIELDER: {
                actionRow = midfieldersActionRow
                break
            }
            case teamService.ROLE_DEFENDER: {
                actionRow = defendersActionRow
                break
            }
        }

        let playerName = role.user ? role.user.name.substring(0, 60) : null
        actionRow.addComponents(
            new MessageButton()
                .setCustomId(`role_${role.name}${selectedLineupNumber ? `_${selectedLineupNumber}` : ''}`)
                .setLabel(role.user == null ? role.name : `${role.name}: ${playerName}`)
                .setStyle('PRIMARY')
                .setDisabled(role.user != null)
        )
    }

    if (attackersActionRow.components.length > 0) {
        components.push(attackersActionRow)
    }
    if (midfieldersActionRow.components.length > 0) {
        components.push(midfieldersActionRow)
    }
    if (defendersActionRow.components.length > 0) {
        components.push(defendersActionRow)
    }
    if (gkActionRow.components.length > 0) {
        components.push(gkActionRow)
    }

    return components
}

function createReplyForTeamLineup(lineup, lineupQueue) {
    return { components: createLineupComponents(lineup, lineupQueue) }
}

function createReplyForMixLineup(interaction, lineup, challengingLineup) {
    let firstLineupEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Team #1`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)
    fillLineupEmbedWithRoles(firstLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 1))

    let secondLineupEmbed
    if (challengingLineup) {
        secondLineupEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`VS`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        let fieldValue = challengingLineup.roles.filter(role => role.user != null).length + ' players signed'
        if (!teamService.hasGkSigned(challengingLineup)) {
            fieldValue += ' **(no gk)**'
        }
        secondLineupEmbed.addField(teamService.formatTeamName(challengingLineup, false), fieldValue)
    } else {
        secondLineupEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Team #2`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        fillLineupEmbedWithRoles(secondLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 2))
    }

    const selectTeamComponentOptions = [{ label: 'Team #1', value: '1' }]
    if (!challengingLineup) {
        selectTeamComponentOptions.push({ label: 'Team #2', value: '2' })
    }
    const selectTeamComponent = new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId(`mix_lineup_select`)
            .setPlaceholder('Select lineup')
            .addOptions(selectTeamComponentOptions))

    const lineupActionsComponent = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`leaveLineup`)
            .setLabel(`Leave`)
            .setStyle('DANGER'))

    return { embeds: [firstLineupEmbed, secondLineupEmbed], components: [selectTeamComponent, lineupActionsComponent] }
}

function createReplyForCaptainsLineup(interaction, lineup) {
    let lineupEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Player queue`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)
    fillLineupEmbedWithRoles(lineupEmbed, lineup.roles)

    const numberOfOutfieldUsers = lineup.roles.filter(role => !role.name.includes('GK') && role.user).length
    const numberOfGkUsers = lineup.roles.filter(role => role.name.includes('GK') && role.user).length
    const lineupActionsComponent = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`leaveQueue`)
            .setLabel(`Leave`)
            .setStyle('DANGER'),
        new MessageButton()
            .setCustomId(`join_outfield`)
            .setLabel(`Join`)
            .setStyle('PRIMARY')
            .setDisabled(numberOfOutfieldUsers === lineup.size*2 - 2),
        new MessageButton()
            .setCustomId(`join_gk`)
            .setLabel(`Join as GK`)
            .setStyle('SECONDARY')
            .setDisabled(numberOfGkUsers === 2))

    return { embeds: [lineupEmbed], components: [lineupActionsComponent] }
}

function fillLineupEmbedWithRoles(lineupEmbed, roles) {
    let description = ''
    roles.map(role => {
        let playerName
        if (role.user) {
            playerName = `${role.user.name}`
        } else {
            playerName = '\u200b'
        }
        description += `**${role.name}:** ${playerName}\n`
    })
    lineupEmbed.setDescription(description)
}