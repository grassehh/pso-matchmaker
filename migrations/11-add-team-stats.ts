import mongoose from 'mongoose';
import dotenv = require('dotenv');
dotenv.config()

async function addTeamStats() {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await mongoose.connection.db.collection('stats').rename('player-stats')
}

addTeamStats()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
    })

