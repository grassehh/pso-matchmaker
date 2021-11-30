const { LineupQueue } = require("../mongoSchema")

exports.findLineupQueueById = async (id) => {
    return await LineupQueue.findById(id).exec()
}

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}