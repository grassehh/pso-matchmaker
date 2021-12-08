const { Team, Lineup } = require("../mongoSchema")
const constants = require("../constants")

const ROLE_GOAL_KEEPER = 0
const ROLE_ATTACKER = 1
const ROLE_DEFENDER = 2
const ROLE_MIDFIELDER = 3

const GK = { name: '🥅 GK', type: ROLE_GOAL_KEEPER }
const LW = { name: 'LW', type: ROLE_ATTACKER }
const CF = { name: 'CF', type: ROLE_ATTACKER }
const RW = { name: 'RW', type: ROLE_ATTACKER }
const LM = { name: 'LM', type: ROLE_MIDFIELDER }
const LCM = { name: 'LCM', type: ROLE_MIDFIELDER }
const CM = { name: 'CM', type: ROLE_MIDFIELDER }
const RCM = { name: 'RCM', type: ROLE_MIDFIELDER }
const RM = { name: 'RM', type: ROLE_MIDFIELDER }
const LB = { name: 'LB', type: ROLE_DEFENDER }
const LCB = { name: 'LCB', type: ROLE_DEFENDER }
const CB = { name: 'CB', type: ROLE_DEFENDER }
const RCB = { name: 'RCB', type: ROLE_DEFENDER }
const RB = { name: 'RB', type: ROLE_DEFENDER }

const DEFAULT_PLAYER_ROLES = new Map([
    [1, [CF]],
    [2, [GK, CF]],
    [3, [GK, LM, RM]],
    [4, [GK, CF, LB, RB]],
    [5, [GK, CF, LB, RB, CB]],
    [6, [GK, LW, RW, CM, LB, RB]],
    [7, [GK, LW, RW, CM, LB, CB, RB]],
    [8, [GK, LW, CF, RW, CM, LB, CB, RB]],
    [9, [GK, LW, CF, RW, LCM, RCM, LB, CB, RB]],
    [10, [GK, LW, CF, RW, LCM, RCM, LB, LCB, RCB, RB]],
    [11, [GK, LW, CF, RW, LM, CM, RM, LB, LCB, RCB, RB]]
])

exports.ROLE_ATTACKER = ROLE_ATTACKER
exports.ROLE_DEFENDER = ROLE_DEFENDER
exports.ROLE_MIDFIELDER = ROLE_MIDFIELDER
exports.ROLE_GOAL_KEEPER = ROLE_GOAL_KEEPER

function removeSpecialCharacters(name) {
    return name.replace(/(:[^:]*:)|(<.*>)/ig, '')
}

exports.validateTeamName = (name) => {
    const filteredName = removeSpecialCharacters(name)
    return filteredName.length > 0 && filteredName.length < constants.MAX_TEAM_NAME_LENGTH
}

exports.validateLineupName = (name) => {
    return !name || (name.length > 0 && name.length < constants.MAX_LINEUP_NAME_LENGTH)
}

exports.formatTeamName = (lineup, filterName) => {
    let name = lineup.team.name
    if (lineup.name) {
        name += ` *(${lineup.name})*`
    }

    return filterName ? removeSpecialCharacters(name) : name
}

exports.hasGkSigned = (lineup) => {
    return lineup.roles.find(role => role.name.includes('GK'))?.user != null
}

exports.updateTeamNameByGuildId = async (guildId, name) => {
    await Team.updateOne({ guildId }, { name })
    await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.name': name })
}

exports.updateTeamRegionByGuildId = async (guildId, region) => {
    await Team.updateOne({ guildId }, { region })
    await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.region': region })
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