const { LineupQueue, Challenge } = require("../mongoSchema")

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}

exports.reserveAndGetLineupQueueById = async (id) => {
    return await LineupQueue.findByIdAndUpdate(id, { reserved: true })
}

exports.reserveAndGetLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId }, { reserved: true })
}

exports.freeLineupQueueById = async (id) => {
    await LineupQueue.updateOne({ '_id': id }, { reserved: false })
}

exports.deleteLineupQueuesByGuildId = async (guildId) => {
    await LineupQueue.deleteMany({ 'team.guildId': guildId })
}

exports.deleteLineupQueueByChannelId = async (channelId) => {
    await LineupQueue.deleteMany({ 'lineup.channelId': channelId })
}

exports.findAvailableLineupQueues = async (channelId, region) => {
    return await LineupQueue.find({ $and: [{ 'lineup.channelId': { '$ne': channelId } }, { 'team.region': region }, { 'reserved': false }] })
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

exports.deleteChallengesByGuildId = async (guildId) => {
    return await Challenge.deleteMany({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}

exports.deleteChallengesByChannelId = async (channelId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.removeUserFromChallenge = async (guildId, channelId, userId) => {
    await Challenge.updateOne(
        {
            guildId,
            $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }],
        },
        {
            "$set": { "initiatingTeam.lineup.roles.$[inner].user": null },
            "$set": { "challengedTeam.lineup.roles.$[inner].user": null }
        },
        {
            "arrayFilters": [{ "inner.user.id": userId }]
        }
    )
}

exports.addUserToChallenge = async (guildId, channelId, roleName, user) => {
    await Challenge.updateOne(
        {
            guildId,
            $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }],
        },
        {
            "$set": { "initiatingTeam.lineup.roles.$[inner].user": user },
            "$set": { "challengedTeam.lineup.roles.$[inner].user": user }
        },
        {
            "arrayFilters": [{ "inner.name": roleName }]
        }
    )
}