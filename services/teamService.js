const { Team, LineupQueue } = require("../mongoSchema")

exports.findTeamByGuildId = async (guildId) => {
    return Team.findOne({ 'guildId': guildId })
}

exports.deleteLineup = async (guildId, channelId) => {
    await Team.updateOne({ guildId }, { $pull: { 'lineups': { channelId } } })
}

exports.retrieveLineup = (team, channelId) => {
    return team.lineups.find(lineup => lineup.channelId == channelId)
}

exports.clearLineup = async (guildId, channelId) => {
    await Team.updateOne(
        {
            guildId,
            "lineups.channelId": channelId,
        },
        {
            "$set": { "lineups.$[].roles.$[].user": null }
        }
    )
}

exports.deleteTeam = async (guildId) => {
    await Team.deleteOne({ guildId })
}

exports.findTeamByGuildId = async (guildId) => {
    return await Team.findOne({ guildId })
}

exports.findLineupByChannelId = async (guildId, channelId) => {
    let team = await this.findTeamByGuildId(guildId)
    return this.retrieveLineup(team, channelId)
}

exports.removeUserFromAllLineupQueue = async (guildId, userId) => {
    await LineupQueue.updateMany({ guildId, 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
}

exports.removeUserFromAllLineups = async (userId) => {
    await Team.updateMany(
        {
            "lineups": {
                "$elemMatch": {
                    "roles.user.id": userId
                }
            }
        },
        {
            "$set": { "lineups.$[].roles.$[inner].user": null }
        },
        {
            "arrayFilters": [{ "inner.user.id": userId }]
        }
    )
}

exports.removeUserFromLineup = async (guildId, channelId, userId) => {
    await Team.updateOne(
        {
            guildId,
            "lineups.channelId": channelId,
        },
        {
            "$set": { "lineups.$.roles.$[inner].user": null }
        },
        {
            "arrayFilters": [{ "inner.user.id": userId }]
        }
    )
}

exports.addUserToLineup = async (guildId, channelId, roleName, user) => {
    await Team.updateOne(
        {
            guildId,
            "lineups.channelId": channelId,
        },
        {
            "$set": { "lineups.$.roles.$[inner].user": user }
        },
        {
            "arrayFilters": [{ "inner.name": roleName }]
        }
    )
}

exports.removeUserFromLineupQueue = async (guildId, channelId, userId) => {
    await LineupQueue.updateOne({ guildId, 'lineup.channelId': channelId, 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
}

exports.addUserToLineupQueue = async (guildId, channelId, roleName, user) => {
    await LineupQueue.updateOne({ guildId, 'lineup.channelId': channelId, 'lineup.roles.name': roleName }, { $set: { "lineup.roles.$.user": user } })
}