const { Team, Lineup } = require("../mongoSchema")
const constants = require("../constants")
const { handle } = require("../utils")
const matchmakingService = require('../services/matchmakingService');

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
    [2, [CF, GK]],
    [3, [LM, RM, GK]],
    [4, [CF, LB, RB, GK]],
    [5, [CF, LB, CB, RB, GK]],
    [6, [LW, RW, CM, LB, RB, GK]],
    [7, [LW, RW, CM, LB, CB, RB, GK]],
    [8, [LW, CF, RW, CM, LB, CB, RB, GK]],
    [9, [LW, CF, RW, LCM, RCM, LB, CB, RB, GK]],
    [10, [LW, CF, RW, LCM, RCM, LB, LCB, RCB, RB, GK]],
    [11, [LW, CF, RW, LM, CM, RM, LB, LCB, RCB, RB, GK]]
])

exports.ROLE_ATTACKER = ROLE_ATTACKER
exports.ROLE_DEFENDER = ROLE_DEFENDER
exports.ROLE_MIDFIELDER = ROLE_MIDFIELDER
exports.ROLE_GOAL_KEEPER = ROLE_GOAL_KEEPER

exports.LINEUP_VISIBILITY_TEAM = 'TEAM'
exports.LINEUP_VISIBILITY_PUBLIC = 'PUBLIC'

exports.LINEUP_TYPE_TEAM = 'TEAM'
exports.LINEUP_TYPE_MIX = 'MIX'
exports.LINEUP_TYPE_CAPTAINS = 'CAPTAINS'

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
    if (lineup.isMix()) {
        name += ' (*mix*)'
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
    let newLineup = lineup.toObject()
    delete newLineup._id
    await Lineup.updateOne({ 'channelId': lineup.channelId }, newLineup, { upsert: true })
}

exports.clearLineup = async (channelId, lineupsToClear = [1]) => {
    return await Lineup.findOneAndUpdate(
        {
            channelId
        },
        {
            "$set": {
                "roles.$[i].user": null
            }
        },
        {
            arrayFilters: [{ "i.lineupNumber": { $in: lineupsToClear } }],
            new: true
        }
    )
}

exports.updateLineupRoles = async (channelId, roles) => {
    return await Lineup.findOneAndUpdate({ channelId }, { roles }, { new: true })
}

exports.startPicking = async (channelId) => {
    return await Lineup.findOneAndUpdate({ channelId }, { isPicking: true }, { new: true })
}

exports.stopPicking = async (channelId) => {
    return await Lineup.findOneAndUpdate({ channelId }, { isPicking: false }, { new: true })
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
    await Lineup.updateMany({ 'channelId': { $in: channelIds }, 'roles.user.id': userId }, { $set: { "roles.$.user": null } })
}

exports.removeUserFromLineup = async (channelId, userId) => {
    return await Lineup.findOneAndUpdate({ channelId, 'roles.user.id': userId, }, { "$set": { "roles.$.user": null } }, { new: true })
}

exports.addUserToLineup = async (channelId, roleName, user, selectedLineup = 1) => {
    return await Lineup.findOneAndUpdate(
        {
            channelId
        },
        {
            "$set": {
                "roles.$[i].user": user
            }
        },
        {
            arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
            new: true
        }
    )
}

exports.clearRoleFromLineup = async (channelId, roleName, selectedLineup = 1) => {
    return await Lineup.findOneAndUpdate(
        {
            channelId
        },
        {
            "$set": {
                "roles.$[i].user": null
            }
        },
        {
            arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
            new: true
        }
    )
}

exports.notifyChannelForUserLeaving = async (client, user, channelId, messageContent) => {
    const [channel] = await handle(client.channels.fetch(channelId))
    if (channel) {
        const lineup = await this.retrieveLineup(channelId)

        const autoSearchResult = await matchmakingService.checkIfAutoSearch(client, user, lineup)
        if (autoSearchResult.leftQueue) {
            messageContent += `. Your team has been removed from the **${lineup.size}v${lineup.size}** queue !`
        }

        await channel.send({ content: messageContent })
    }
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

exports.findChannelIdsFromGuildIdAndUserId = async (guildId, userId) => {
    let res = await Lineup.aggregate([
        {
            $match: {
                'team.guildId': guildId,
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
                type: { $nin: [this.LINEUP_TYPE_MIX, this.LINEUP_TYPE_CAPTAINS] },
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

exports.createLineup = (channelId, size, name, autoSearch, team, type, visibility) => {
    let roles = DEFAULT_PLAYER_ROLES.get(size).map(obj => ({ ...obj, lineupNumber: 1 }))
    if (type === this.LINEUP_TYPE_MIX) {
        roles = roles.concat(DEFAULT_PLAYER_ROLES.get(size).map(obj => ({ ...obj, lineupNumber: 2 })))
    } else if (type === this.LINEUP_TYPE_CAPTAINS) {
        roles = []
        let i = 1
        while (i < size) {
            roles.push({ name: i, lineupNumber: 1 })
            i++
        }
        while (i < (size * 2)-1) {
            roles.push({ name: i, lineupNumber: 2 })
            i++
        }
        roles.push({ ...GK, lineupNumber: 1 })
        roles.push({ ...GK, lineupNumber: 2 })
    }
    let lineup = new Lineup({
        channelId,
        size,
        roles,
        name,
        autoSearch,
        team,
        type,
        visibility
    })

    return lineup
}