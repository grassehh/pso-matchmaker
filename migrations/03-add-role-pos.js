const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Lineup, Challenge, LineupQueue } = require('../mongoSchema');
const teamService = require('../services/teamService');
dotenv.config()

async function addRolePos() {
    await mongoose.connect(process.env.MONGO_URI || '')

    await Challenge.deleteMany({})
    await LineupQueue.deleteMany({ "lineup.type": teamService.LINEUP_TYPE_TEAM })
    const lineupQueues = await LineupQueue.find({})
    const lineups = await Lineup.find({})

    let lineupBulks = []
    for (const lineup of lineups) {
        const newLineup = teamService.createLineup(lineup.channelId, lineup.size, lineup.name, lineup.autoSearch, lineup.team, lineup.type, lineup.visibility)
        lineupBulks.push({
            updateOne: {
                filter: { channelId: lineup.channelId },
                update: { roles: newLineup.roles }
            }
        })
    }
    await Lineup.bulkWrite(lineupBulks)

    let lineupQueueBulks = []
    for (const lineupQueue of lineupQueues) {
        const newLineup = teamService.createLineup(lineupQueue.lineup.channelId, lineupQueue.lineup.size, lineupQueue.lineup.name, lineupQueue.lineup.autoSearch, lineupQueue.lineup.team, lineupQueue.lineup.type, lineupQueue.lineup.visibility)
        lineupQueueBulks.push({
            updateOne: {
                filter: { channelId: lineupQueue.lineup.channelId },
                update: { "lineup.roles": newLineup.roles }
            }
        })
    }
    await LineupQueue.bulkWrite(lineupQueueBulks)
}

addRolePos()
    .catch(console.error)
    .finally(async res => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

