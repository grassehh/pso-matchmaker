import mongoose from 'mongoose';
import dotenv = require('dotenv');
dotenv.config()

async function addTeamStats() {
    await mongoose.connect(process.env.MONGO_URI || '')
    await mongoose.connection.db.collection('bans').rename('player-bans')
}

addTeamStats()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
    })

