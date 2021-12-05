const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { LineupQueue, Challenge } = require("../mongoSchema")
const teamService = require("../services/teamService");
const matchmakingService = require("../services/matchmakingService");

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
    await LineupQueue.deleteOne({ channelId })
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
    let lineupQueue = await new LineupQueue({ lineup })
    let teamName = `'${teamService.formatTeamName(lineup)}'`
    if (!teamService.hasGkSigned(lineupQueue.lineup)) {
        teamName += ' *(no gk)*'
    }
    let channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)
    let notifyChannelPromises = []
    for await (let channelId of channelIds) {
        notifyChannelPromises.push(
            interaction.client.channels.fetch(channelId)
                .then((channel) => {
                    const teamEmbed = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle(`Team ${teamName} has joined the queue for ${lineup.size}v${lineup.size}`)
                        .setTimestamp()
                        .setFooter(`Author: ${interaction.user.username}`)

                    let challengeTeamRow = new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId(`challenge_${lineupQueue.id}`)
                            .setLabel('Challenge them !')
                            .setEmoji('⚽')
                            .setStyle('PRIMARY')
                    )
                    return channel.send({ embeds: [teamEmbed], components: [challengeTeamRow] })
                })
                .then((message) => {
                    return { channelId: message.channelId, messageId: message.id }
                })
        )
    }
    return Promise.all(notifyChannelPromises).then(notificationsMessages => {
        lineupQueue.notificationMessages = notificationsMessages
        lineupQueue.save()
    })
}

exports.leaveQueue = async (interaction, lineupQueue) => {
    let updateChannelsPromises = []
    if (lineupQueue.notificationMessages.length > 0) {
        for await (notificationMessage of lineupQueue.notificationMessages) {
            updateChannelsPromises.push(
                interaction.client.channels.fetch(notificationMessage.channelId)
                    .then((channel) => {
                        channel.messages.delete(notificationMessage.messageId)
                    })
            )
        }
    }
    return Promise.all(updateChannelsPromises).then(matchmakingService.deleteLineupQueueByChannelId(interaction.channelId))
}

exports.isLineupAllowedToJoinQueue = (lineup) => {
    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
    let numberOfMissingPlayers = lineup.size - numberOfPlayersSigned
    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
    return numberOfMissingPlayers == 0 || (numberOfMissingPlayers == 1 && missingRoleName.includes('GK'))
}