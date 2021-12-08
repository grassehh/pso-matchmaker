const { PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING } = require("../constants")
const { Stats } = require("../mongoSchema")
const { handle } = require("../utils")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

function getLevelingRoleIdsFromStats(userStats) {
    let roles = []
    if (userStats.numberOfGames > 50) {
        roles.push(process.env.PSO_EU_DISCORD_CONFIRMED_ROLE_ID)
    }
    if (userStats.numberOfGames > 250) {
        roles.push(process.env.PSO_EU_DISCORD_ADVANCED_ROLE_ID)
    }
    if (userStats.numberOfGames > 800) {
        roles.push(process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID)
    }
    return roles
}

async function findElligibleStatsForLevelling(userIds) {
    return await Stats.aggregate([
        {
            $match: {
                userId: {
                    $in: userIds
                },
                lineupSize: {
                    $gte: PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING
                }
            }
        },
        {
            $group: {
                _id: '$userId',
                numberOfGames: {
                    $sum: '$numberOfGames',
                }
            }
        }
    ])
}

exports.upgradePlayersLevel = async (interaction, userIds) => {
    const allElligibleStats = await findElligibleStatsForLevelling(userIds)

    return Promise.all(allElligibleStats.map(async elligibleStats => {
        const [psoEuGuild] = await handle(interaction.client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID))
        if (!psoEuGuild) {
            return
        }
        const levelingRoleIds = getLevelingRoleIdsFromStats(elligibleStats)
        const [member] = await handle(psoEuGuild.members.fetch(elligibleStats._id))
        if (member) {
            handle(member.roles.add(levelingRoleIds))
        }
    }))
}

exports.incrementGamesPlayed = async (guildId, lineupSize, users) => {
    let bulks = users.map((user) => ({
        updateOne: {
            filter: {
                guildId,
                lineupSize,
                'userId': user.id
            },
            update: {
                $inc: { numberOfGames: 1 },
                $setOnInsert: {
                    guildId,
                    userId: user.id
                },
            },
            upsert: true
        }
    }))
    await Stats.bulkWrite(bulks)
}

exports.countNumberOfPlayers = async (guildId, lineupSizes = []) => {
    let match = {}
    if (guildId) {
        match.guildId = guildId
    }
    if (lineupSizes.length > 0) {
        match.lineupSize = { $in: lineupSizes.map(size => parseInt(size)) }
    }
    return (await Stats.distinct('userId', match)).length
}

exports.findStats = async (userId, guildId, page, size, lineupSizes = []) => {
    let skip = page * size
    let pipeline = []

    if (userId) {
        pipeline.push(
            {
                $match: { 'userId': userId }
            }
        )
    }

    if (guildId) {
        pipeline.push(
            {
                $match: { 'guildId': guildId }
            }
        )
    }

    if (lineupSizes.length > 0) {
        pipeline.push(
            {
                $match: { lineupSize: { $in: lineupSizes.map(size => parseInt(size)) } }
            }
        )
    }

    if (userId) {
        pipeline.push(
            {
                $group: {
                    _id: null,
                    numberOfGames: {
                        $sum: '$numberOfGames',
                    }
                }
            })
    } else {
        pipeline = pipeline.concat([
            {
                $group: {
                    _id: '$userId',
                    numberOfGames: {
                        $sum: '$numberOfGames',
                    }
                }
            },
            {
                $sort: { 'numberOfGames': -1 },
            },
            {
                $skip: skip
            },
            {
                $limit: size
            }
        ])
    }
    return await Stats.aggregate(pipeline)
}