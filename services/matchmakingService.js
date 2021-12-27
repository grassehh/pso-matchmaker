const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { LineupQueue, Challenge, Stats } = require("../mongoSchema")
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const interactionUtils = require("../services/interactionUtils");
const { handle } = require("../utils");
const { MERC_USER_ID } = require("../constants");

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}

exports.findLineupQueueById = async (id) => {
    return await LineupQueue.findById(id)
}

exports.reserveLineupQueuesByIds = async (ids) => {
    await LineupQueue.updateMany({ '_id': { $in: ids } }, { reserved: true })
}

exports.freeLineupQueuesByIds = async (ids) => {
    await LineupQueue.updateMany({ '_id': { $in: ids } }, { reserved: false })
}

exports.deleteLineupQueuesByGuildId = async (guildId) => {
    await LineupQueue.deleteMany({ 'team.guildId': guildId })
}

exports.deleteLineupQueuesByChannelId = async (channelId) => {
    await LineupQueue.deleteMany({ 'lineup.channelId': channelId })
}

exports.findAvailableLineupQueues = async (region, channelId, lineupSize, guildId) => {
    return await LineupQueue.find(
        {
            'lineup.channelId': { '$ne': channelId },
            'team.region': region,
            'lineup.size': lineupSize,
            $or: [
                { 'lineup.visibility': teamService.LINEUP_VISIBILITY_PUBLIC },
                {
                    $and: [
                        { 'lineup.visibility': teamService.LINEUP_VISIBILITY_TEAM },
                        { 'lineup.team.guildId': guildId }
                    ]
                }
            ],
            'reserved': false
        }
    )
}

exports.findChallengeById = async (id) => {
    return await Challenge.findById(id)
}

exports.findChallengeByGuildId = async (guildId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}

exports.findChallengeByChannelId = async (channelId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.deleteChallengeById = async (id) => {
    await Challenge.deleteOne({ '_id': id })
}

exports.deleteChallengesByGuildId = async (guildId) => {
    return await Challenge.deleteMany({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}

exports.deleteChallengesByChannelId = async (channelId) => {
    await Challenge.deleteMany({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.addUserToLineupQueue = async (channelId, roleName, user, selectedLineup = 1) => {
    return await LineupQueue.findOneAndUpdate(
        {
            'lineup.channelId': channelId
        },
        {
            "$set": {
                "lineup.roles.$[i].user": user
            }
        },
        {
            arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
            new: true
        }
    )
}

exports.removeUserFromLineupQueue = async (channelId, userId) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId, 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } }, { new: true })
}

exports.removeUserFromAllLineupQueues = async (userId) => {
    await LineupQueue.updateMany({ 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
}

exports.clearLineupQueue = async (channelId, selectedLineups = [1]) => {
    return await LineupQueue.findOneAndUpdate(
        {
            'lineup.channelId': channelId
        },
        {
            $set: {
                "lineup.roles.$[i].user": null
            }
        },
        {
            arrayFilters: [{ "i.lineupNumber": { $in: selectedLineups } }]
        }
    )
}

exports.updateLineupQueueRoles = async (channelId, roles) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId }, { 'lineup.roles': roles }, { new: true })
}

exports.joinQueue = async (client, user, lineup) => {
    const lineupQueue = new LineupQueue({ lineup })
    const channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)

    await Promise.all(channelIds.map(async channelId => {
        const teamEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`A Team has joined the queue for ${lineup.size}v${lineup.size}`)
            .setTimestamp()
            .setFooter(`Author: ${user.username}`)
        let lineupFieldValue = lineup.roles.filter(role => role.user != null).length + ' players signed'
        if (!teamService.hasGkSigned(lineupQueue.lineup)) {
            lineupFieldValue += ' **(no gk)**'
        }
        teamEmbed.addField(teamService.formatTeamName(lineup), lineupFieldValue)

        const challengeTeamRow = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(`challenge_${lineupQueue.id}`)
                .setLabel('Challenge them !')
                .setEmoji('⚽')
                .setStyle('PRIMARY')
        )
        const [channel] = await handle(client.channels.fetch(channelId))
        if (!channel) {
            return null
        }
        const [message] = await handle(channel.send({ embeds: [teamEmbed], components: [challengeTeamRow] }))
        return message ? { channelId: message.channelId, messageId: message.id } : null
    }))
        .then(notificationsMessages => {
            lineupQueue.notificationMessages = notificationsMessages.filter(notificationMessage => notificationMessage)
        })
        .catch(console.error)
        .finally(() => lineupQueue.save())

    return lineupQueue
}

exports.leaveQueue = async (client, lineupQueue) => {
    Promise.all(lineupQueue.notificationMessages.map(async notificationMessage => {
        const channel = await client.channels.fetch(notificationMessage.channelId)
        handle(channel.messages.delete(notificationMessage.messageId))
    }))
        .catch(console.error)
        .finally(() => this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId))
}

exports.checkIfAutoSearch = async (client, user, lineup) => {
    let lineupQueue = await this.findLineupQueueByChannelId(lineup.channelId)
    let autoSearchResult = { joinedQueue: false, leftQueue: false, updatedLineupQueue: lineupQueue }

    if (!lineup.isMixOrCaptains()) {
        if (lineup.autoSearch === true && isLineupAllowedToJoinQueue(lineup)) {
            if (!lineupQueue) {
                autoSearchResult.updatedLineupQueue = await this.joinQueue(client, user, lineup)
                autoSearchResult.joinedQueue = true
            }
        } else if (!isLineupAllowedToJoinQueue(lineup) && lineupQueue) {
            let challenge = await this.findChallengeByGuildId(lineup.team.guildId)
            if (!challenge) {
                await this.leaveQueue(client, lineupQueue)
                autoSearchResult.updatedLineupQueue = null
                autoSearchResult.leftQueue = true
            }
        }
    }

    return autoSearchResult
}

exports.isLineupAllowedToJoinQueue = isLineupAllowedToJoinQueue

exports.isUserAllowedToInteractWithMatchmaking = (userId, lineup) => {
    return lineup.roles.some(role => role.user?.id === userId)
}

exports.isMixOrCaptainsReadyToStart = async (lineup) => {

    if (lineup.isCaptains()) {
        return isLineupAllowedToJoinQueue(lineup)
    }

    const challenge = await this.findChallengeByChannelId(lineup.channelId)

    if (challenge && challenge.challengedTeam.lineup.isMix()) {
        const initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
        const mixTeamLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)

        const missingRolesForTeam = initiatingTeamLineup.roles.filter(role => role.user == null)
        const missingRolesForMix = mixTeamLineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user == null)
        const allMissingRoles = missingRolesForMix.concat(missingRolesForTeam)

        return allMissingRoles.length == 0 || (allMissingRoles.length == 1 && allMissingRoles[0].name.includes('GK'))
    }

    if (!challenge && lineup.isMix()) {
        return isLineupAllowedToJoinQueue(lineup)
    }

    return
}

exports.checkForDuplicatedPlayers = async (interaction, firstLineup, secondLineup) => {
    let firstLineupUsers
    let secondLineupUsers
    if (secondLineup) {
        firstLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(user => user)
        secondLineupUsers = secondLineup.roles.map(role => role.user).filter(user => user)
    } else {
        firstLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(user => user)
        secondLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 2).map(role => role.user).filter(user => user)
    }

    let duplicatedUsers = firstLineupUsers.filter((user, index, self) =>
        user.id !== MERC_USER_ID &&
        secondLineupUsers.some((t) => (
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

        await interaction.channel.send({ embeds: [duplicatedUsersEmbed] })
        await interaction.deferUpdate()
        return true
    }

    return false
}

exports.readyMatch = async (interaction, challenge, mixLineup) => {
    let firstResponsibleUser = await interaction.client.users.fetch(challenge ? challenge.initiatingUser.id : interaction.user)
    let lobbyCreationEmbedFieldValue = `${firstResponsibleUser} is responsible of creating the lobby`
    if (challenge) {
        lobbyCreationEmbedFieldValue += `. If he is not available, then ${interaction.user} is the next responsible player.`
    }
    let lobbyCreationEmbed = new MessageEmbed()
        .setColor('#6aa84f')
        .setTitle(`${challenge ? '⚽ Challenge Accepted ⚽' : '⚽ Match Ready ⚽'}`)
        .setTimestamp()
        .addField('Each player has received the lobby information in private message', lobbyCreationEmbedFieldValue)

    const lobbyPassword = Math.random().toString(36).slice(-4)

    if (challenge) {
        const lobbyName = `${teamService.formatTeamName(challenge.initiatingTeam.lineup)} vs. ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`
        await this.deleteChallengeById(challenge.id)
        let initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
        const initiatingTeamUsers = initiatingTeamLineup.roles.map(role => role.user).filter(user => user)
        let challengedTeamLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)
        const challengedTeamUsers = challengedTeamLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(user => user)

        let promises = []
        promises.push(new Promise(async (resolve, reject) => {
            await this.leaveQueue(interaction.client, challenge.initiatingTeam)
            const newInitiatingTeamLineup = await teamService.clearLineup(initiatingTeamLineup.channelId)
            let lineupForNextMatchEmbeds = await interactionUtils.createLineupEmbedsForNextMatch(interaction, initiatingTeamLineup, challenge.challengedTeam.lineup, lobbyName, lobbyPassword)
            const reply = await interactionUtils.createReplyForLineup(interaction, newInitiatingTeamLineup)
            reply.embeds = lineupForNextMatchEmbeds.concat(lobbyCreationEmbed)
            let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
            await initiatingTeamChannel.send(reply)
            await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
            resolve()
        }))
        promises.push(new Promise(async (resolve, reject) => {
            if (challengedTeamLineup.isMix()) {
                await this.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])
                await teamService.clearLineup(challengedTeamLineup.channelId, [1, 2])
                await this.clearLineupQueue(challenge.challengedTeam.lineup.channelId, [1, 2])
                let lineupForNextMatchEmbeds = await interactionUtils.createLineupEmbedsForNextMatch(interaction, challengedTeamLineup, initiatingTeamLineup, lobbyName, lobbyPassword)
                let rolesInFirstLineup = challengedTeamLineup.roles.filter(role => role.lineupNumber === 1)
                let rolesInSecondLineup = challengedTeamLineup.roles.filter(role => role.lineupNumber === 2)
                rolesInFirstLineup.forEach(role => { role.user = null; role.lineupNumber = 2 })
                rolesInSecondLineup.forEach(role => role.lineupNumber = 1)
                const newRoles = rolesInFirstLineup.concat(rolesInSecondLineup)
                const newChallengedTeamLineup = await teamService.updateLineupRoles(challengedTeamLineup.channelId, newRoles)
                await this.updateLineupQueueRoles(challengedTeamLineup.channelId, newRoles)
                const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup)
                reply.embeds = lineupForNextMatchEmbeds.concat(lobbyCreationEmbed).concat(reply.embeds)
                let challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                await challengedTeamChannel.send(reply)
            } else {
                await this.leaveQueue(interaction.client, challenge.challengedTeam)
                const newChallengedTeamLineup = await teamService.clearLineup(challengedTeamLineup.channelId)
                let lineupForNextMatchEmbeds = await interactionUtils.createLineupEmbedsForNextMatch(interaction, challengedTeamLineup, initiatingTeamLineup, lobbyName, lobbyPassword)
                const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup)
                reply.embeds = lineupForNextMatchEmbeds.concat(lobbyCreationEmbed)
                await interaction.editReply(reply)
                await interaction.message.edit({ components: [] })
            }

            resolve()
        }))

        await Promise.all(promises)
        await statsService.updateStats(interaction, challenge.initiatingTeam.lineup.team.guildId, challenge.initiatingTeam.lineup.size, initiatingTeamUsers)
        await statsService.updateStats(interaction, challenge.challengedTeam.lineup.team.guildId, challenge.challengedTeam.lineup.size, challengedTeamUsers)
    }
    else { //This is a mix vs mix match     
        const lobbyName = `${teamService.formatTeamName(mixLineup, true)} #${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        await teamService.clearLineup(mixLineup.channelId, [1, 2])
        const allUsers = mixLineup.roles.map(role => role.user).filter(user => user)
        let mixNextMatchEmbeds = await interactionUtils.createLineupEmbedsForNextMatch(interaction, mixLineup, null, lobbyName, lobbyPassword)
        let newMixLineup = teamService.createLineup(interaction.channelId, mixLineup.size, mixLineup.name, mixLineup.autoSearch, mixLineup.team, mixLineup.type, mixLineup.visibility)
        const reply = await interactionUtils.createReplyForLineup(interaction, newMixLineup)
        reply.embeds = mixNextMatchEmbeds.concat(lobbyCreationEmbed).concat(reply.embeds)
        await interaction.channel.send(reply)
        await this.clearLineupQueue(mixLineup.channelId, [1, 2])
        await statsService.updateStats(interaction, interaction.guildId, newMixLineup.size, allUsers)
    }
}

exports.findTwoMostRelevantCaptainsIds = async (userIds) => {
    let pipeline = []
    pipeline.push(
        {
            $match: { 'userId': { $in: userIds } }
        }
    )

    pipeline = pipeline.concat([
        {
            $group: {
                _id: '$userId',
                numberOfGames: {
                    $sum: '$numberOfGames',
                }
            }
        },
        {
            $sort: { 'numberOfGames': -1 },
        },
        {
            $limit: 3
        },
        {
            $sample: {
                size: 3
            }
        }
    ])

    return await Stats.aggregate(pipeline)
}

function isLineupAllowedToJoinQueue(lineup) {
    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
    let lineupSize = lineup.isMixOrCaptains() ? lineup.size * 2 : lineup.size
    let numberOfMissingPlayers = lineupSize - numberOfPlayersSigned
    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
    return numberOfMissingPlayers == 0 || (numberOfMissingPlayers == 1 && missingRoleName.includes('GK'))
}