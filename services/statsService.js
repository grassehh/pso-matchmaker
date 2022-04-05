const { MINIMUM_LINEUP_SIZE_FOR_RANKED, MERC_USER_ID } = require("../constants")
const { Stats } = require("../mongoSchema")
const { handle } = require("../utils")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

function getLevelingRoleIdFromStats(userStats) {
    if (userStats.numberOfRankedGames >= 800) {
        return process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID
    }
    if (userStats.numberOfRankedGames >= 250) {
        return process.env.PSO_EU_DISCORD_EXPERT_ROLE_ID
    }
    if (userStats.numberOfRankedGames >= 50) {
        return process.env.PSO_EU_DISCORD_CHALLENGER_ROLE_ID
    }

    return process.env.PSO_EU_DISCORD_BEGINNER_ROLE_ID
}

async function findUsersStats(userIds) {
    return await Stats.aggregate([
        {
            $match: {
                userId: {
                    $in: userIds
                }
            }
        },
        {
            $group: {
                _id: '$userId',
                numberOfGames: {
                    $sum: '$numberOfGames',
                },
                numberOfRankedGames: {
                    $sum: '$numberOfRankedGames',
                }
            }
        }
    ])
}

exports.getLevelEmojiFromMember = (member) => {
    if (member.roles.cache.some(role => role.id === process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID)) {
        return '🔴 '
    }
    if (member.roles.cache.some(role => role.id === process.env.PSO_EU_DISCORD_EXPERT_ROLE_ID)) {
        return '🟣 '
    }
    if (member.roles.cache.some(role => role.id === process.env.PSO_EU_DISCORD_CHALLENGER_ROLE_ID)) {
        return '🟠 '
    }
    if (member.roles.cache.some(role => role.id === process.env.PSO_EU_DISCORD_BEGINNER_ROLE_ID)) {
        return '🟡 '
    }

    return ''
}

exports.countNumberOfPlayers = async (region) => {
    return (await Stats.distinct('userId', region ? { region } : {})).length
}

exports.findStats = async (userId, region, page, size) => {
    let skip = page * size
    let pipeline = []

    let match = {}
    if (userId) {
        match.userId = userId
    }

    if (region) {
        match.region = region
    }

    pipeline.push({ $match: match })

    if (userId) {
        pipeline.push(
            {
                $group: {
                    _id: null,
                    numberOfGames: {
                        $sum: '$numberOfGames'
                    },
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames'
                    }
                }
            })
    } else {
        pipeline = pipeline.concat([
            {
                $group: {
                    _id: '$userId',
                    numberOfGames: {
                        $sum: '$numberOfGames'
                    },
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames'
                    }
                }
            },
            {
                $sort: { 'numberOfRankedGames': -1 },
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

exports.updateStats = async (interaction, region, lineupSize, users) => {
    const notMercUsers = users.filter(user => user?.id !== MERC_USER_ID)
    if (notMercUsers.length === 0) {
        return
    }

    const bulks = notMercUsers.map((user) => ({
        updateOne: {
            filter: {
                region,
                'userId': user.id
            },
            update: {
                $inc: {
                    numberOfGames: 1,
                    numberOfRankedGames: lineupSize >= MINIMUM_LINEUP_SIZE_FOR_RANKED ? 1 : 0
                },
                $setOnInsert: {
                    userId: user.id,
                    region
                },
            },
            upsert: true
        }
    }))
    await Stats.bulkWrite(bulks)

    if (region === 'EU' && lineupSize >= MINIMUM_LINEUP_SIZE_FOR_RANKED) {
        const psoEuGuild = await interaction.client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID)
        const usersStats = await findUsersStats(notMercUsers.map(user => user.id))

        await Promise.all(usersStats.map(async userStats => {
            const levelingRoleId = getLevelingRoleIdFromStats(userStats)
            const [member] = await handle(psoEuGuild.members.fetch(userStats._id))
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