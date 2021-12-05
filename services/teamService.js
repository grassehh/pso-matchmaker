const { Team, Lineup } = require("../mongoSchema")

exports.formatTeamName = (lineup) => {
    let name = lineup.team.name
    if (lineup.name) {
        name += ` *(${lineup.name})*`
    }
    return name
}

exports.hasGkSigned = (lineup) => {
    return lineup.roles.find(role => role.name === 'GK')?.user != null
}

exports.deleteLineup = async (channelId) => {
    await Lineup.deleteOne({ channelId })
}

exports.retrieveLineup = async (channelId) => {
    return await Lineup.findOne({ channelId })
}

exports.upsertLineup = async (lineup) => {
    await Lineup.updateOne({ 'channelId': lineup.channelId }, lineup, { upsert: true })
}

exports.clearLineup = async (channelId) => {
    return await Lineup.findOneAndUpdate({ channelId }, { "$set": { "roles.$[].user": null } }, { new: true })
}

exports.clearLineups = async (channelIds) => {
    await Lineup.updateMany({ 'channelId': { $in: channelIds } }, { "$set": { "roles.$[].user": null } })
}

exports.deleteTeam = async (guildId) => {
    await Team.deleteOne({ guildId })
}

exports.findTeamByGuildId = async (guildId) => {
    return await Team.findOne({ guildId })
}

exports.removeUserFromLineupsByGuildId = async (userId, guildId) => {
    return await Lineup.updateMany({ 'team.guildId': guildId, 'roles.user.id': userId }, { $set: { "roles.$.user": null } })
}

exports.removeUserFromLineupsByChannelIds = async (userId, channelIds) => {
    return await Lineup.updateMany({ 'channelId': { $in: channelIds }, 'roles.user.id': userId }, { $set: { "roles.$.user": null } })
}

exports.removeUserFromLineup = async (channelId, userId) => {
    return await Lineup.findOneAndUpdate({ channelId, 'roles.user.id': userId }, { "$set": { "roles.$.user": null } }, { new: true })
}

exports.addUserToLineup = async (channelId, roleName, user) => {
    return await Lineup.findOneAndUpdate({ channelId, 'roles.name': roleName }, { "$set": { "roles.$.user": user } }, { new: true })
}

exports.findAllLineupChannelIdsByUserId = async (userId) => {
    let res = await Lineup.aggregate([
        {
            $match: {
                roles: {
                    $elemMatch: { 'user.id': userId }
                }
            }
        },
        {
            $group: {
                _id: null,
                channelIds: {
                    $addToSet: '$$ROOT.channelId'
                }
            }
        }
    ])

    if (res.length > 0) {
        return res[0].channelIds
    }

    return []
}


exports.findAllLineupChannelIdsByUserIds = async (userIds) => {
    let res = await Lineup.aggregate([
        {
            $match: {
                roles: {
                    $elemMatch: { 'user.id': userId }
                }
            }
        },
        {
            $group: {
                _id: null,
                channelIds: {
                    $addToSet: '$$ROOT.channelId'
                }
            }
        }
    ])

    if (res.length > 0) {
        return res[0].channelIds
    }

    return []
}


exports.findAllChannelIdToNotify = async (region, channelId, lineupSize) => {
    let res = await Lineup.aggregate([
        {
            $match: {
                'team.region': region,
                channelId: { $ne: channelId },
                size: lineupSize
            }
        },
        {
            $group: {
                _id: null,
                channelIds: {
                    $addToSet: '$$ROOT.channelId'
                }
            }
        }
    ])

    if (res.length > 0) {
        return res[0].channelIds
    }

    return []
}