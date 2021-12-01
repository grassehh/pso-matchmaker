const { Team, LineupQueue } = require("../mongoSchema")

exports.deleteLineup = async (guildId, channelId) => {
    await Team.updateOne({ guildId }, { $pull: { 'lineups': { channelId } } })
}

exports.retrieveLineup = (team, channelId) => {
    return team.lineups.find(lineup => lineup.channelId == channelId)
}

exports.clearLineup = async (team, channelId) => {
    let lineup = this.retrieveLineup(team, channelId)
    lineup.roles.forEach(role => {
        role.user = null
    });
    await team.save()
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

exports.updateLineupQueueRole = async (guildId, channelId, playerRole) => {
    await LineupQueue.updateOne({ guildId, 'lineup.channelId': channelId, 'lineup.roles.name': playerRole.name }, { $set: { "lineup.roles.$.user": playerRole.user }})
}