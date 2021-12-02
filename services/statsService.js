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

exports.findStatsByUserId = async (userId) => {
    return await Stats.findOne({ 'user.id': userId })
}

function distinctUsers(users) {
    return users.filter((user, index, self) =>
        index === self.findIndex((t) => (
            t.id === user.id
        ))
    )
}