const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { LineupQueue, Challenge, Stats, Match } = require("../mongoSchema")
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const interactionUtils = require("../services/interactionUtils");
const { handle } = require("../utils");
const { MERC_USER_ID } = require("../constants");
const { v4 } = require("uuid");

function isLineupAllowedToJoinQueue(lineup) {
    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
    let lineupSize = lineup.isMixOrCaptains() ? lineup.size * 2 : lineup.size
    let numberOfMissingPlayers = lineupSize - numberOfPlayersSigned
    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
    return numberOfMissingPlayers == 0 || (lineup.size > 3 && (numberOfMissingPlayers == 1 && missingRoleName.includes('GK')))
}

async function freeLineupQueuesByChallengeIds(challengeIds) {
    if (challengeIds.length > 0) {
        await LineupQueue.updateMany({ 'challengeId': { $in: challengeIds } }, { challengeId: null })
    }
}

async function removeUserFromAllLineupQueues(userId) {
    await LineupQueue.updateMany({ 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
}

async function enhanceWithDiscordUsers(client, roles) {
    const promises = roles.map(async (role) => {
        if (!role.user) {
            return role
        }

        const [discordUser] = await handle(client.users.fetch(role.user.id))
        role.discordUser = discordUser

        return role
    })

    return Promise.all(promises)
}

async function notifyUsersForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, opponentLineup) {
    let discordUsersWithoutDm = []

    const promises = rolesWithDiscordUsers.map(async (role) => {
        if (!role.discordUser) {
            return
        }

        let embeds = []
        embeds.push(new MessageEmbed()
            .setColor('#6aa84f')
            .setTitle(`⚽ Match Ready ⚽`)
            .setDescription(`**Please join the match as soon as possible**\nThe lobby can be found in the **"Custom Lobbies"** menu of the game\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***\n\n`)
            .addField('Lobby Name', `${match.lobbyName}`, true)
            .addField('Lobby Password', `${match.lobbyPassword}`, true)
            .addField('Lobby Host', `${lobbyHost.username}`, true)
            .setTimestamp())

        embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(role => role.lineupNumber === 1), opponentLineup))
        if (!opponentLineup) {
            embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(role => role.lineupNumber === 2), opponentLineup))
        }

        const [message] = await handle(role.discordUser.send({ embeds }))
        if (!message) {
            discordUsersWithoutDm.push(role.discordUser)
        }
    })

    await Promise.all(promises)

    if (discordUsersWithoutDm.length > 0) {
        const embed = new MessageEmbed()
            .setColor('#6aa84f')
            .setTitle('⚠ Some players did not receive the lobby information ⚠')
            .setDescription(discordUsersWithoutDm.join(', '))
            .setTimestamp()
        await interaction.channel.send({ embeds: [embed] })
    }
}

async function notifyLineupsForUsersLeaving(interaction, rolesWithDiscordUsers, lineup) {
    const promises = rolesWithDiscordUsers.map(async (role) => {
        if (!role.discordUser) {
            return
        }

        let channelIds = await teamService.findAllLineupChannelIdsByUserId(role.discordUser.id, [lineup.channelId])
        if (channelIds.length > 0) {
            await removeUserFromAllLineupQueues(role.discordUser.id)
            await teamService.removeUserFromLineupsByChannelIds(role.discordUser.id, channelIds)
            await Promise.all(channelIds.map(async channelId => {
                await teamService.notifyChannelForUserLeaving(interaction.client, role.discordUser, channelId, `⚠ ${role.discordUser} went to play another match with **${teamService.formatTeamName(lineup)}**`)
            }))
        }
    })

    return Promise.all(promises)
}

async function notifyLineupChannelForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, lineup, opponentLineup) {
    let embeds = []

    embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(role => role.lineupNumber === 1), opponentLineup))
    if (!opponentLineup) {
        embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(role => role.lineupNumber === 2), opponentLineup))
    }

    const matchReadyEmbed = new MessageEmbed()
        .setColor('#6aa84f')
        .setTitle(`${opponentLineup ? '⚽ Challenge Accepted ⚽' : '⚽ Match Ready ⚽'}`)
        .setTimestamp()
        .setDescription(`**${lobbyHost.username}** is responsible of creating the lobby\nPlease check your direct messages to find the lobby information\n\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***`)
    embeds.push(matchReadyEmbed)

    const channel = await interaction.client.channels.fetch(lineup.channelId)
    await channel.send({ embeds })
}

async function notifyLineupForMatchReady(interaction, match, lobbyHost, lineup, opponentLineup) {
    if (!lineup) {
        return
    }

    const rolesWithDiscordUsers = await enhanceWithDiscordUsers(
        interaction.client,
        opponentLineup
            ? lineup.roles.filter(role => role.lineupNumber === 1)
            : lineup.roles)

    let promises = []
    promises.push(notifyLineupChannelForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, lineup, opponentLineup))
    promises.push(notifyUsersForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, opponentLineup))
    promises.push(notifyLineupsForUsersLeaving(interaction, rolesWithDiscordUsers, lineup))
    return Promise.all(promises)
}

exports.updateBanList = async (client) => {
    const banListEmbed = await interactionUtils.createBanListEmbed(client, process.env.PSO_EU_DISCORD_GUILD_ID)
    const channel = await client.channels.fetch(process.env.PSO_EU_DISCORD_BANS_CHANNEL_ID)
    const messages = await channel.messages.fetch({ limit: 1 })
    if (messages.size === 0) {
        await channel.send({ embeds: [banListEmbed] })
    } else {
        await messages.at(0).edit({ embeds: [banListEmbed] }).catch(
            async (e) => { await channel.send({ embeds: [banListEmbed] }) }
        )
    }
}

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}

exports.findLineupQueueById = async (id) => {
    return await LineupQueue.findById(id)
}

exports.reserveLineupQueuesByIds = async (ids, challengeId) => {
    await LineupQueue.updateMany({ '_id': { $in: ids } }, { challengeId })
}

exports.freeLineupQueuesByChallengeId = async (challengeId) => {
    await LineupQueue.updateMany({ challengeId }, { challengeId: null })
}

exports.deleteLineupQueuesByGuildId = async (guildId) => {
    await LineupQueue.deleteMany({ 'lineup.team.guildId': guildId })
}

exports.deleteLineupQueuesByChannelId = async (channelId) => {
    await LineupQueue.deleteMany({ 'lineup.channelId': channelId })
}

exports.findAvailableLineupQueues = async (region, channelId, lineupSize, guildId) => {
    return await LineupQueue.find(
        {
            'lineup.channelId': { '$ne': channelId },
            'lineup.team.region': region,
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
            'challengeId': null
        }
    )
}

exports.findChallengeById = async (id) => {
    return await Challenge.findById(id)
}

exports.findChallengeByChannelId = async (channelId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.deleteChallengeById = async (id) => {
    await Challenge.deleteOne({ '_id': id })
}

exports.deleteChallengesByGuildId = async (guildId) => {
    const challengeIds = (await Challenge.find({ $or: [{ 'initiatingTeam.lineup.team.guildId': guildId }, { 'challengedTeam.lineup.team.guildId': guildId }] }, { _id: 1 })).map(challenge => challenge._id.toString())
    await freeLineupQueuesByChallengeIds(challengeIds)
    return await Challenge.deleteMany({ $or: [{ 'initiatingTeam.lineup.team.guildId': guildId }, { 'challengedTeam.lineup.team.guildId': guildId }] })
}

exports.deleteChallengesByChannelId = async (channelId) => {
    const challengeIds = (await Challenge.find({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] }, { _id: 1 })).map(challenge => challenge._id.toString())
    await freeLineupQueuesByChallengeIds(challengeIds)
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

    let description = `**${teamService.formatTeamName(lineup)}**`
    const teamEmbed = new MessageEmbed()
        .setColor('#566573')
        .setTitle('A team is looking for a match !')
        .setTimestamp()
    description += `\n${lineup.roles.filter(role => role.user != null).length} players signed`
    if (!teamService.hasGkSigned(lineupQueue.lineup)) {
        description += ' **(no GK)**'
    }
    description += `\n\n*Contact ${user} for more information*`
    teamEmbed.setDescription(description)

    const challengeTeamRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`challenge_${lineupQueue.id}`)
            .setLabel('Challenge them !')
            .setEmoji('⚽')
            .setStyle('PRIMARY')
    )

    await Promise.all(channelIds.map(async channelId => {
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
    if (lineupQueue.lineup.isMixOrCaptains()) {
        return
    }

    Promise.all(lineupQueue.notificationMessages.map(async notificationMessage => {
        const channel = await client.channels.fetch(notificationMessage.channelId)
        handle(channel.messages.delete(notificationMessage.messageId))
    }))
        .catch(console.error)
        .finally(() => this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId))

    this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId)
}

exports.challenge = async (interaction, lineupQueueIdToChallenge) => {
    let lineupQueueToChallenge = await this.findLineupQueueById(lineupQueueIdToChallenge)
    if (!lineupQueueToChallenge) {
        await interaction.reply({ content: "⛔ This team is no longer challenging", ephemeral: true })
        return
    }

    let challenge = await this.findChallengeByChannelId(interaction.channelId)
    if (challenge) {
        await interactionUtils.replyAlreadyChallenging(interaction, challenge)
        return
    }

    challenge = await this.findChallengeByChannelId(lineupQueueToChallenge.lineup.channelId)
    if (challenge) {
        await interaction.reply({ content: "⛔ This team is negociating a challenge", ephemeral: true })
        return
    }

    let lineup = await teamService.retrieveLineup(interaction.channelId)
    if (!lineup) {
        await this.replyLineupNotSetup(interaction)
        return
    }

    if (!this.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
        await interaction.reply({ content: `⛔ You must be in the lineup in order to challenge a team`, ephemeral: true })
        return
    }

    if (!this.isLineupAllowedToJoinQueue(lineup)) {
        await interaction.reply({ content: '⛔ All outfield positions must be filled before challenging a team', ephemeral: true })
        return
    }

    if (lineupQueueToChallenge.lineup.size !== lineup.size) {
        await interaction.reply({ content: `⛔ Your team is configured for ${lineup.size}v${lineup.size} while the team you are trying to challenge is configured for ${lineupQueueToChallenge.lineup.size}v${lineupQueueToChallenge.lineup.size}. Both teams must have the same size to challenge.`, ephemeral: true })
        return
    }

    if (await this.checkForDuplicatedPlayers(interaction, lineup, lineupQueueToChallenge.lineup)) {
        return
    }

    let lineupQueue = await this.findLineupQueueByChannelId(interaction.channelId)
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
    let challengedMessage = await channel.send(interactionUtils.createDecideChallengeReply(interaction, challenge))
    challenge.challengedMessageId = challengedMessage.id

    await this.reserveLineupQueuesByIds([lineupQueueIdToChallenge, lineupQueue.id], challenge.id)
    let initiatingMessage = await interaction.channel.send(interactionUtils.createCancelChallengeReply(interaction, challenge))
    challenge.initiatingMessageId = initiatingMessage.id

    await challenge.save()

    await interaction.deferUpdate()

    if (await this.isMixOrCaptainsReadyToStart(lineupQueueToChallenge.lineup)) {
        await this.readyMatch(interaction, challenge, lineup)
        return
    }
}

exports.cancelChallenge = async (client, user, challengeId) => {
    const challenge = await this.findChallengeById(challengeId)
    if (!challenge) {
        return
    }

    await this.deleteChallengeById(challenge.id)
    await this.freeLineupQueuesByChallengeId(challenge.id)

    const [challengedTeamChannel] = await handle(client.channels.fetch(challenge.challengedTeam.lineup.channelId))
    if (challengedTeamChannel) {
        if (!challenge.challengedTeam.lineup.isMix()) {
            await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
        }
        await challengedTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ **${teamService.formatTeamName(challenge.initiatingTeam.lineup)}** has cancelled the challenge request`)] })
    }

    const [initiatingTeamChannel] = await handle(client.channels.fetch(challenge.initiatingTeam.lineup.channelId))
    if (initiatingTeamChannel) {
        await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
        await initiatingTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ ${user} has cancelled the challenge request against **${teamService.formatTeamName(challenge.challengedTeam.lineup)}**`)] })
    }
}

exports.checkIfAutoSearch = async (client, user, lineup) => {
    let lineupQueue = await this.findLineupQueueByChannelId(lineup.channelId)
    let autoSearchResult = { joinedQueue: false, leftQueue: false, cancelledChallenge: false, updatedLineupQueue: lineupQueue }

    if (lineup.isMixOrCaptains()) {
        return autoSearchResult
    }

    if (lineup.autoSearch === true && isLineupAllowedToJoinQueue(lineup) && !lineupQueue) {
        autoSearchResult.updatedLineupQueue = await this.joinQueue(client, user, lineup)
        autoSearchResult.joinedQueue = true
        return autoSearchResult
    }

    if (!isLineupAllowedToJoinQueue(lineup)) {
        const challenge = await this.findChallengeByChannelId(lineup.channelId)

        if (challenge) {
            await this.cancelChallenge(client, user, challenge.id)
            autoSearchResult.cancelledChallenge = true
        }

        if (lineupQueue) {
            await this.leaveQueue(client, lineupQueue)
            autoSearchResult.updatedLineupQueue = null
            autoSearchResult.leftQueue = true
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

        return allMissingRoles.length == 0 || (lineup.size > 3 && (allMissingRoles.length == 1 && allMissingRoles[0].name.includes('GK')))
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
            .setColor('#566573')
            .setTitle(`⛔ Some players are signed in both teams !`)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user.username}` })

        await interaction.channel.send({ embeds: [duplicatedUsersEmbed] })
        await interaction.deferUpdate()
        return true
    }

    return false
}

exports.removeUserFromAllLineupQueues = removeUserFromAllLineupQueues

exports.readyMatch = async (interaction, challenge, mixLineup) => {
    const firstLineup = challenge ? await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId) : mixLineup
    const secondLineup = challenge ? await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId) : undefined
    const lobbyHost = challenge ? await interaction.client.users.fetch(challenge.initiatingUser.id) : interaction.user
    const lobbyName = challenge
        ? `${teamService.formatTeamName(challenge.initiatingTeam.lineup)} vs. ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`
        : `${teamService.formatTeamName(mixLineup, true)} #${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    const lobbyPassword = Math.random().toString(36).slice(-4)
    const match = await new Match({
        matchId: v4().substring(0, 8),
        schedule: Date.now(),
        lobbyName,
        lobbyPassword,
        firstLineup,
        secondLineup
    }).save()

    if (challenge) {
        await this.deleteChallengeById(challenge.id)
        await this.freeLineupQueuesByChallengeId(challenge.id)
    }

    let matchReadyPromises = []
    matchReadyPromises.push(notifyLineupForMatchReady(interaction, match, lobbyHost, firstLineup, secondLineup))
    matchReadyPromises.push(notifyLineupForMatchReady(interaction, match, lobbyHost, secondLineup, firstLineup))
    await Promise.all(matchReadyPromises)

    if (challenge) {
        const initiatingTeamUsers = firstLineup.roles.map(role => role.user).filter(user => user)
        const challengedTeamUsers = secondLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(user => user)

        let promises = []
        promises.push(new Promise(async (resolve, reject) => {
            await this.leaveQueue(interaction.client, challenge.initiatingTeam)
            const newInitiatingTeamLineup = await teamService.clearLineup(firstLineup.channelId)
            const reply = await interactionUtils.createReplyForLineup(interaction, newInitiatingTeamLineup)
            reply.embeds = [interactionUtils.createInformationEmbed(lobbyHost, "Lineup cleared")]
            const initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
            await initiatingTeamChannel.send(reply)
            await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
            resolve()
        }))
        promises.push(new Promise(async (resolve, reject) => {
            if (secondLineup.isMix()) {
                await teamService.clearLineup(secondLineup.channelId, [1, 2])
                await this.clearLineupQueue(challenge.challengedTeam.lineup.channelId, [1, 2])
                let rolesInFirstLineup = secondLineup.roles.filter(role => role.lineupNumber === 1)
                let rolesInSecondLineup = secondLineup.roles.filter(role => role.lineupNumber === 2)
                rolesInFirstLineup.forEach(role => { role.user = null; role.lineupNumber = 2 })
                rolesInSecondLineup.forEach(role => role.lineupNumber = 1)
                const newRoles = rolesInFirstLineup.concat(rolesInSecondLineup)
                const newChallengedTeamLineup = await teamService.updateLineupRoles(secondLineup.channelId, newRoles)
                await this.updateLineupQueueRoles(secondLineup.channelId, newRoles)
                const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup)
                const challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                await challengedTeamChannel.send(reply)
            } else {
                await this.leaveQueue(interaction.client, challenge.challengedTeam)
                const newChallengedTeamLineup = await teamService.clearLineup(secondLineup.channelId)
                await interaction.editReply(`${interaction.user} accepted the challenge request`)
                const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup)
                reply.embeds = [interactionUtils.createInformationEmbed(interaction.user, "Lineup cleared")]
                await interaction.message.edit({ components: [] })
                await interaction.channel.send(reply)
            }

            resolve()
        }))
        await Promise.all(promises)

        await statsService.updateStats(interaction, challenge.initiatingTeam.lineup.team.region, challenge.initiatingTeam.lineup.size, initiatingTeamUsers)
        await statsService.updateStats(interaction, challenge.challengedTeam.lineup.team.region, challenge.challengedTeam.lineup.size, challengedTeamUsers)
    }
    else { //This is a mix vs mix match  
        await teamService.clearLineup(mixLineup.channelId, [1, 2])
        const allUsers = mixLineup.roles.map(role => role.user).filter(user => user)
        const newMixLineup = teamService.createLineup(interaction.channelId, mixLineup.size, mixLineup.name, mixLineup.autoSearch, mixLineup.team, mixLineup.type, mixLineup.visibility)
        const reply = await interactionUtils.createReplyForLineup(interaction, newMixLineup)
        await interaction.channel.send(reply)
        await this.clearLineupQueue(mixLineup.channelId, [1, 2])
        await statsService.updateStats(interaction, mixLineup.team.region, mixLineup.size, allUsers)
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
            $limit: 4
        },
        {
            $sample: {
                size: 4
            }
        }
    ])

    return await Stats.aggregate(pipeline)
}

exports.findMatchByMatchId = async (matchId) => {
    return await Match.findOne({ matchId })
}

exports.addSubToMatch = async (matchId, role) => {
    await Match.updateOne(
        { matchId },
        {
            "$push": {
                "subs": role
            }
        }
    )
}