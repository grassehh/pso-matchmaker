import mongoose from 'mongoose';
import { Stats } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function addTotalNumberStats() {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    const statsBulkWrites = []
    await Stats.updateMany({}, { $unset: { numberOfGames: "" } })
    const stats = await Stats.find({})
    for (const stat of stats) {
        statsBulkWrites.push({
            updateOne: {
                filter: { _id: stat._id },
                update: {
                    $set: {
                        totalNumberOfRankedWins: stat.numberOfRankedWins,
                        totalNumberOfRankedDraws: stat.numberOfRankedDraws,
                        totalNumberOfRankedLosses: stat.numberOfRankedLosses
                    }
                }
            }
        })
    }
    await Stats.bulkWrite(statsBulkWrites)
}

addTotalNumberStats()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

