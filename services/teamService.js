const { Team } = require("../mongoSchema")

exports.deleteLineup = async (guildId, channelId) => {
    await Team.updateOne({ guildId }, { $pull: { 'lineups': { channelId } } })
}

exports.deleteTeam = async (guildId) => {
    await Team.deleteOne({ guildId })
}

exports.findTeamByGuildId = async (guildId) => {
    return await Team.findOne({ guildId })
}

exports.findTeamByChannelId = async (channelId) => {
    return await Team.findOne({ 'lineups.channelId': channelId })
}