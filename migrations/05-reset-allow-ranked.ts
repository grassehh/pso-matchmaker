import mongoose from 'mongoose';
import { Lineup } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function resetAllowRanked() {
    await mongoose.connect(process.env.MONGO_URI || '')
    await Lineup.updateMany({ type: 'TEAM' }, { $set: { allowRanked: true } })
}

resetAllowRanked()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

