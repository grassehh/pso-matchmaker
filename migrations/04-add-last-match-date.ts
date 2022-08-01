import mongoose from 'mongoose';
import { Lineup, Team } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

async function addRolePos() {
    const date = new Date()
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await Lineup.updateMany({}, { $set: { lastMatchDate: date } })
    await Team.updateMany({}, { $set: { lastMatchDate: date } })
}

addRolePos()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

