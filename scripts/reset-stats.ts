import mongoose from 'mongoose';
import { DEFAULT_RATING } from '../bot/src/constants';
import { Lineup, LineupQueue, PlayerStats, Team, TeamStats, User } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function resetStats(): Promise<void> {
    await mongoose.connect(process.env.MONGO_URI || '')
    await User.updateMany({}, {
        $set: {
            rating: DEFAULT_RATING
        }
    })
    await PlayerStats.updateMany({}, {
        $set: {
            numberOfRankedWins: 0,
            numberOfRankedDraws: 0,
            numberOfRankedLosses: 0,
            totalNumberOfRankedWins: 0,
            totalNumberOfRankedDraws: 0,
            totalNumberOfRankedLosses: 0,
            rating: DEFAULT_RATING
        }
    })
    await Team.updateMany({}, { $set: { rating: DEFAULT_RATING } })
    await Lineup.updateMany({}, { $set: { 'team.rating': DEFAULT_RATING } })
    await LineupQueue.updateMany({}, { $set: { 'lineup.team.rating': DEFAULT_RATING } })
    await TeamStats.updateMany({}, {
        $set: {
            numberOfRankedWins: 0,
            numberOfRankedDraws: 0,
            numberOfRankedLosses: 0,
            totalNumberOfRankedWins: 0,
            totalNumberOfRankedDraws: 0,
            totalNumberOfRankedLosses: 0,
            rating: DEFAULT_RATING
        }
    })
}

resetStats().finally(async () => {
    console.log("Reset stats finished");
    await mongoose.disconnect();
    process.exit();
})

