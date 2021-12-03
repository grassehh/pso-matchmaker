const { Stats } = require("../mongoSchema")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

exports.incrementGamesPlayed = async (guildId, users) => {
    let bulks = distinctUsers(users).map((user) => ({
        updateOne: {
            filter: {
                guildId,
                'user.id': user.id
            },
            update: {
                $inc: { numberOfGames: 1 },
                $setOnInsert: {
                    guildId,
                    user: { id: user.id }
                },
            },
            upsert: true
        }
    }))
    Stats.bulkWrite(bulks)
}

exports.findStatsByUserId = async (userId, guildId) => {
    let stats
    if (guildId) {
        stats = await Stats.findOne({ 'user.id': userId, guildId })

    } else {
        stats = await Stats.aggregate([
            {
                $match: { 'user.id': userId }
            },
            {
                $group: { _id: null, numberOfGames: { $sum: "$numberOfGames" } }
            }
        ])
        stats = stats && stats[0]
    }
    return stats
}

exports.countNumberOfPlayers = async (guildId) => {
    let count
    if (guildId) {
        count = await Stats.count({ guildId })
    } else {
        let distinct = await Stats.distinct( 'user.id' )
        count = distinct.length
    }
    return count
}

exports.findStats = async (guildId, page = 0, size = 10) => {
    let stats
    let skip = page*size
    if (guildId) {
        stats = await Stats.find({ guildId }).sort({ numberOfGames: -1 }).limit(size).skip(skip)
    } else {
        stats = await Stats.aggregate([
            {
                $group: {
                    _id: '$user.id',
                    data: { $first: '$$ROOT' },
                    totalNumberOfGames: {
                        $sum: '$numberOfGames',
                    }
                }
            },
            {
                $sort: { 'totalNumberOfGames': -1 },
            },
            {
                $skip: skip
            },
            {
                $limit: size
            },
            {
                $replaceRoot: {
                    newRoot: { $mergeObjects: [{ totalNumberOfGames: '$totalNumberOfGames' }, '$data'] },
                }
            }
        ])
    }
    return stats
}

function distinctUsers(users) {
    return users.filter((user, index, self) =>
        index === self.findIndex((t) => (
            t.id === user.id
        ))
    )
}