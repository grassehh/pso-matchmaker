import mongoose from 'mongoose';
import { DEFAULT_RATING } from '../bot/src/constants';
import { Stats, Team } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function resetStats(): Promise<void> {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await Stats.updateMany({}, {
        $set: {
            numberOfRankedWins: 0,
            numberOfRankedDraws: 0,
            numberOfRankedLosses: 0,
            totalNumberOfRankedWins: 0,
            totalNumberOfRankedDraws: 0,
            totalNumberOfRankedLosses: 0,
            attackRating: DEFAULT_RATING,
            midfieldRating: DEFAULT_RATING,
            defenseRating: DEFAULT_RATING,
            goalKeeperRating: DEFAULT_RATING,
            mixCaptainsRating: DEFAULT_RATING
        }
    })
    await Team.updateMany({}, {
        $set: {
            rating: DEFAULT_RATING
        }
    })
}

resetStats().finally(async () => {
    console.log("Reset stats finished");
    await mongoose.disconnect();
    process.exit();
})

