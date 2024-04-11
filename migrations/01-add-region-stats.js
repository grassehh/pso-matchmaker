const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Stats } = require('../mongoSchema');
dotenv.config()

async function addRegionToStats() {
    await mongoose.connect(process.env.MONGO_URI || '')
    await Stats.updateMany({}, { $set: { region: 'EU' } })
}

addRegionToStats().then(async res => {
    console.log("Migration finished")
    await mongoose.disconnect()
    process.exit()
})

