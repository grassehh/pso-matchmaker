const { PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING, MERC_USER_ID } = require("../constants")
const { Stats } = require("../mongoSchema")
const { handle } = require("../utils")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

function getLevelingRoleIdsFromStats(userStats) {
    let roles = []
    if (userStats.numberOfGames >= 50) {
        roles.push(process.env.PSO_EU_DISCORD_CONFIRMED_ROLE_ID)
    }
    if (userStats.numberOfGames >= 250) {
        roles.push(process.env.PSO_EU_DISCORD_ADVANCED_ROLE_ID)
    }
    if (userStats.numberOfGames >= 800) {
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

exports.deleteStatsByGuildId = async (guildId) => {
    await Stats.deleteMany({ guildId })
}

exports.countNumberOfPlayers = async (region, guildId, lineupSizes = []) => {
    let match = {}
    if (region) {
        match.region = region
    }
    if (guildId) {
        match.guildId = guildId
    }
    if (lineupSizes.length > 0) {
        match.lineupSize = { $in: lineupSizes.map(size => parseInt(size)) }
    }
    return (await Stats.distinct('userId', match)).length
}

exports.findStats = async (userId, region, guildId, page, size, lineupSizes = []) => {
    let skip = page * size
    let pipeline = []

    let match = {}
    if (userId) {
        match.userId = userId
    }

    if (region) {
        match.region = region
    }

    if (guildId) {
        match.guildId = guildId
    }

    if (lineupSizes.length > 0) {
        match.lineupSize = { $in: lineupSizes.map(size => parseInt(size)) }
    }

    pipeline.push({ $match: match })

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

exports.updateStats = async (interaction, region, guildId, lineupSize, users) => {
    notMercUsers = users.filter(user => user?.id !== MERC_USER_ID)
    if (notMercUsers.length === 0) {
        return
    }

    let bulks = notMercUsers.map((user) => ({
        updateOne: {
            filter: {
                region,
                guildId,
                lineupSize,
                'userId': user.id
            },
            update: {
                $inc: { numberOfGames: 1 },
                $setOnInsert: {
                    region,
                    guildId,
                    userId: user.id
                },
            },
            upsert: true
        }
    }))
    await Stats.bulkWrite(bulks)

    if (interaction.guildId === process.env.PSO_EU_DISCORD_GUILD_ID && lineupSize >= PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING) {
        const allElligibleStats = await findElligibleStatsForLevelling(notMercUsers.map(user => user.id))

        await Promise.all(allElligibleStats.map(async elligibleStats => {
            const [psoEuGuild] = await handle(interaction.client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID))
            const levelingRoleIds = getLevelingRoleIdsFromStats(elligibleStats)
            const [member] = await handle(psoEuGuild.members.fetch(elligibleStats._id))
            if (member) {
                await handle(member.roles.add(levelingRoleIds))
            }
        }))
    }
}