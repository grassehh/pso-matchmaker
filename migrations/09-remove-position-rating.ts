import mongoose from 'mongoose';
import { Stats } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
import { DEFAULT_RATING } from '../bot/src/constants';
dotenv.config()

async function removePositionRating() {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    const statsBulkWrites = []
    await Stats.updateMany({}, { $unset: { numberOfGames: "", attackRating: "", midfieldRating: "", defenseRating: "", goalKeeperRating: "" } })
    const stats = await Stats.find({})
    for (const stat of stats) {
        statsBulkWrites.push({
            updateOne: {
                filter: { _id: stat._id },
                update: {
                    $set: {
                        rating: DEFAULT_RATING,
                        totalNumberOfRankedWins: 0,
                        totalNumberOfRankedDraws: 0,
                        totalNumberOfRankedLosses: 0,
                        numberOfRankedWins: 0,
                        numberOfRankedDraws: 0,
                        numberOfRankedLosses: 0
                    }
                }
            }
        })
    }
    await Stats.bulkWrite(statsBulkWrites)
}

removePositionRating()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

