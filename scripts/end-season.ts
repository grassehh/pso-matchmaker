import mongoose from 'mongoose';
import { DEFAULT_RATING } from '../bot/src/constants';
import { Lineup, Stats, Team } from '../bot/src/mongoSchema';
import { regionService } from '../bot/src/services/regionService';
import dotenv = require('dotenv');
dotenv.config()

async function endSeason(): Promise<void> {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await Team.updateMany({}, { $set: { rating: DEFAULT_RATING } })
    await Lineup.updateMany({}, { $set: { 'team.rating': DEFAULT_RATING } })
    const allRegionData = regionService.getAllRegionsData()
    for (const regionData of allRegionData) {
        const newTier1PlayersRating = regionData.tier2Threshold! - 100
        const newTier2PlayersRating = (regionData.tier2Threshold! + regionData.tier3Threshold!) / 2
        const newTier3PlayersRating = regionData.tier3Threshold! + 100
        const regionStats = await Stats.find({ region: regionData.region })
        const bulks: any = []
        for (const stats of regionStats) {
            const tierRoleId = regionService.getTierRoleId(regionData.region, stats.rating)
            let rating = DEFAULT_RATING
            if (tierRoleId === regionData.tier1RoleId) {
                rating = newTier1PlayersRating
            } else if (tierRoleId === regionData.tier2RoleId) {
                rating = newTier2PlayersRating
            } else if (tierRoleId) {
                rating = newTier3PlayersRating
            }
            bulks.push({
                updateOne: {
                    filter: { _id: stats._id },
                    update: {
                        $set: {
                            rating,
                            numberOfRankedWins: 0,
                            numberOfRankedDraws: 0,
                            numberOfRankedLosses: 0
                        }
                    }
                }
            })
        }
        await Stats.bulkWrite(bulks)
    }
}

endSeason().finally(async () => {
    console.log("Season ended");
    await mongoose.disconnect();
    process.exit();
})

