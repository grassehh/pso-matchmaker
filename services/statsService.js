const { PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING, MERC_USER_ID } = require("../constants")
const { Stats } = require("../mongoSchema")
const { handle } = require("../utils")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

function getLevelingRoleIdFromStats(userStats) {
    if (userStats.numberOfGames >= 800) {
        return process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID
    }
    if (userStats.numberOfGames >= 250) {
        return process.env.PSO_EU_DISCORD_EXPERT_ROLE_ID
    }
    if (userStats.numberOfGames >= 50) {
        return process.env.PSO_EU_DISCORD_CHALLENGER_ROLE_ID
    }

    return process.env.PSO_EU_DISCORD_BEGINNER_ROLE_ID
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

    if (region === 'EU' && lineupSize >= PSO_EU_MINIMUM_LINEUP_SIZE_LEVELING) {
        const psoEuGuild = await interaction.client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID)
        const allElligibleStats = await findElligibleStatsForLevelling(notMercUsers.map(user => user.id))

        await Promise.all(allElligibleStats.map(async elligibleStats => {
            const levelingRoleId = getLevelingRoleIdFromStats(elligibleStats)
            const [member] = await handle(psoEuGuild.members.fetch(elligibleStats._id))
            if (member) {
                await handle(member.roles.add(levelingRoleId))
                if (levelingRoleId === process.env.PSO_EU_DISCORD_CHALLENGER_ROLE_ID) {
                    await handle(member.roles.remove(process.env.PSO_EU_DISCORD_BEGINNER_ROLE_ID))
                } else if (levelingRoleId === process.env.PSO_EU_DISCORD_EXPERT_ROLE_ID) {
                    await handle(member.roles.remove(process.env.PSO_EU_DISCORD_CHALLENGER_ROLE_ID))
                } else if (levelingRoleId === process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID) {
                    await handle(member.roles.remove(process.env.PSO_EU_DISCORD_EXPERT_ROLE_ID))
                }
            }
        }))
    }
}