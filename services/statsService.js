const { Stats } = require("../mongoSchema")

exports.DEFAULT_LEADERBOARD_PAGE_SIZE = 10

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
    Stats.bulkWrite(bulks)
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