const { Team, Lineup } = require("../mongoSchema")
const constants = require("../constants")

const DEFAULT_PLAYER_ROLES = new Map([
    [1, [{ name: 'CF' }]],
    [2, [{ name: '🥅 GK' }, { name: 'CF' }]],
    [3, [{ name: '🥅 GK' }, { name: 'LM' }, { name: 'RM' }]],
    [4, [{ name: '🥅 GK' }, { name: 'CF' }, { name: 'LB' }, { name: 'RB' }]],
    [5, [{ name: '🥅 GK' }, { name: 'CF' }, { name: 'LB' }, { name: 'RB' }, { name: 'CB' }]],
    [6, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'RW' }, { name: 'CM' }, { name: 'LB' }, { name: 'RB' }]],
    [7, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'RW' }, { name: 'CM' }, { name: 'LB' }, { name: 'CB' }, { name: 'RB' }]],
    [8, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'CM' }, { name: 'LB' }, { name: 'CB' }, { name: 'RB' }]],
    [9, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'LCM' }, { name: 'RCM' }, { name: 'LB' }, { name: 'CB' }, { name: 'RB' }]],
    [10, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'LCM' }, { name: 'RCM' }, { name: 'LB' }, { name: 'LCB' }, { name: 'RCB' }, { name: 'RB' }]],
    [11, [{ name: '🥅 GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'LM' }, { name: 'CM' }, { name: 'RM' }, { name: 'LB' }, { name: 'LCB' }, { name: 'RCB' }, { name: 'RB' }]]
])

exports.validateTeamName = (name) => {
    return name.length > 0 && name.length < constants.MAX_TEAM_NAME_LENGTH
}

exports.validateLineupName = (name) => {
    return !name || (name.length > 0 && name.length < constants.MAX_LINEUP_NAME_LENGTH)
}

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

exports.updateTeamNameByGuildId = async (guildId, name) => {
    await Team.updateOne({ guildId }, { name })
    await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.name': name })
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

exports.deleteLineupsByGuildId = async (guildId) => {
    await Lineup.deleteMany({ 'team.guildId': guildId })
}

exports.findTeamByGuildId = async (guildId) => {
    return await Team.findOne({ guildId })
}

exports.findTeamByRegionAndName = async (region, name) => {
    return await Team.findOne({ region, name })
}

exports.removeUserFromAllLineups = async (userId) => {
    return await Lineup.updateMany({ 'roles.user.id': userId }, { $set: { "roles.$.user": null } })
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

exports.createLineup = (channelId, size, name, autoSearch, team) => {
    return {
        channelId,
        size,
        roles: DEFAULT_PLAYER_ROLES.get(size),
        name,
        autoSearch,
        team
    }
}