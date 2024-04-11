import mongoose from 'mongoose';
import { PlayerStats } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function addTotalNumberStats() {
    await mongoose.connect(process.env.MONGO_URI || '')

    const statsBulkWrites = []
    await PlayerStats.updateMany({}, { $unset: { numberOfGames: "" } })
    const stats = await PlayerStats.find({})
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
    await PlayerStats.bulkWrite(statsBulkWrites)
}

addTotalNumberStats()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

