const { Stats } = require("../mongoSchema")

exports.incrementGamesPlayed = async (users) => {
    console.log(distinctUsers(users))
    let bulks = distinctUsers(users).map((user) => ({
        updateOne: {
            filter: { 'user.id': user.id },
            update: {
                $inc: { numberOfGames: 1 },
                $setOnInsert: { user: { id: user.id } },
            },
            upsert: true
        }
    }))
    Stats.bulkWrite(bulks)
}

function distinctUsers(users) {
    return users.filter((user, index, self) =>
        index === self.findIndex((t) => (
            t.id === user.id
        ))
    )
}