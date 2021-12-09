const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { LineupQueue, Challenge } = require("../mongoSchema")
const teamService = require("../services/teamService");
const matchmakingService = require("../services/matchmakingService");
const { handle } = require("../utils");

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

exports.deleteLineupQueuesByIds = async (ids) => {
    await LineupQueue.deleteMany({ '_id': { $in: ids } })
}

exports.deleteLineupQueueByChannelId = async (channelId) => {
    await LineupQueue.deleteOne({ 'lineup.channelId': channelId })
}

exports.findAvailableLineupQueues = async (region, channelId, lineupSize) => {
    return await LineupQueue.find({ 'lineup.channelId': { '$ne': channelId }, 'team.region': region, 'lineup.size': lineupSize, 'reserved': false })
}

exports.findChallengeById = async (id) => {
    return await Challenge.findById(id)
}

exports.findChallengeByLineupQueueId = async (lineupQueueId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam._id': lineupQueueId }, { 'challengedTeam._id': lineupQueueId }] })
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

exports.addUserToLineupQueue = async (channelId, roleName, user) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId, 'lineup.roles.name': roleName }, { $set: { "lineup.roles.$.user": user } }, { new: true })
}

exports.removeUserFromLineupQueue = async (channelId, userId) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId, 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } }, { new: true })
}

exports.removeUserFromAllLineupQueues = async (userId, guildId) => {
    await LineupQueue.updateMany({ 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
}

exports.joinQueue = async (interaction, lineup) => {
    const lineupQueue = new LineupQueue({ lineup })
    let teamName = `'${teamService.formatTeamName(lineup)}'`
    if (!teamService.hasGkSigned(lineupQueue.lineup)) {
        teamName += ' *(no gk)*'
    }
    const channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)

    await Promise.all(channelIds.map(async channelId => {
        const teamEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Team ${teamName} has joined the queue for ${lineup.size}v${lineup.size}`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)

        const challengeTeamRow = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(`challenge_${lineupQueue.id}`)
                .setLabel('Challenge them !')
                .setEmoji('⚽')
                .setStyle('PRIMARY')
        )
        const channel = await interaction.client.channels.fetch(channelId)
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
        .finally(() => matchmakingService.deleteLineupQueueByChannelId(lineupQueue.lineup.channelId))
}

exports.isLineupAllowedToJoinQueue = (lineup) => {
    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
    let numberOfMissingPlayers = lineup.size - numberOfPlayersSigned
    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
    return numberOfMissingPlayers == 0 || (numberOfMissingPlayers == 1 && missingRoleName.includes('GK'))
}

exports.isUserAllowedToInteractWithMathmaking = (userId, lineup) => {
    return lineup.roles.some(role => role.user?.id === userId)
}