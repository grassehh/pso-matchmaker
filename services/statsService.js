const { Stats } = require("../mongoSchema")

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
    if (!guildId) {
        stats = await Stats.aggregate([
            {
                $match: { 'user.id': userId }
            },
            {
                $group: { _id: null, numberOfGames: { $sum: "$numberOfGames" } }
            }
        ])
        stats = stats && stats[0]
    } else {
        stats = await Stats.findOne({ 'user.id': userId, guildId })
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