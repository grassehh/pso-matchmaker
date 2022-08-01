const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Stats } = require('../mongoSchema');
const { MINIMUM_LINEUP_SIZE_FOR_RANKED } = require("../constants")
dotenv.config()

async function factorizeStats() {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    const statsByUser = await Stats.aggregate([{
        $group: {
            _id: '$userId',
            res: {
                $addToSet: '$$ROOT'
            }
        }
    }])

    let bulks = []
    for (const userStats of statsByUser) {
        const userId = userStats._id
        const statsByRegion = userStats.res.reduce(function (rv, x) {
            (rv[x['region']] = rv[x['region']] || []).push(x);
            return rv;
        }, {});

        for (var region in statsByRegion) {
            if (Object.prototype.hasOwnProperty.call(statsByRegion, region)) {
                const stats = statsByRegion[region]
                const numberOfGames = stats.reduce((acc, cur) => acc + cur.numberOfGames, 0)
                const numberOfRankedGames = stats.filter(stat => stat.lineupSize >= MINIMUM_LINEUP_SIZE_FOR_RANKED).reduce((acc, cur) => acc + cur.numberOfGames, 0)
                bulks.push({ insertOne: { "document": { userId, region, numberOfGames, numberOfRankedGames } } })
            }
        }
    }
    mongoose.connection.db.dropCollection('stats', function (err, result) { })
    await Stats.bulkWrite(bulks)
}

factorizeStats()
    .catch(console.error)
    .finally(async res => {
    console.log("Migration finished")
    await mongoose.disconnect()
    process.exit()
})

