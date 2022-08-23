import mongoose from 'mongoose';
import { Stats } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function resetStats(): Promise<void> {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await Stats.updateMany({}, {
        $set: {
            numberOfRankedWins: 0,
            numberOfRankedDraws: 0,
            numberOfRankedLosses: 0
        }
    })
}

resetStats().finally(async () => {
    console.log("Ended season succesfully");
    await mongoose.disconnect();
    process.exit();
})

