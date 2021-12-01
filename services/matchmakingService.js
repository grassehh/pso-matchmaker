const { LineupQueue, Challenge } = require("../mongoSchema")

exports.findLineupQueueById = async (id) => {
    return await LineupQueue.findById(id)
}

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

exports.findAvailableLineupQueues = async (channelId, region) => {
    return await LineupQueue.find({ $and: [{ 'lineup.channelId': { '$ne': channelId } }, { 'team.region': region }, { 'reserved': false }] })
}

exports.findChallengeById = async (id) => {
    return await Challenge.findById(id)
}

exports.findChallengeByGuildId = async (guildId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}