const { LineupQueue } = require("../mongoSchema")

exports.findLineupQueueById = async (id) => {
    return await LineupQueue.findById(id).exec()
}

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}

exports.reserveAndGetLineupQueueById = async (id) => {
    return await LineupQueue.findByIdAndUpdate(id, { reserved: true })
}

exports.findAvailableLineupQueues = async (channelId, region) => {
    return await LineupQueue.find({ $and: [{ 'lineup.channelId': { '$ne': channelId } }, { 'team.region': region }, { 'reserved': false }] })
}