import mongoose from 'mongoose';
import { Lineup, Team } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
import { teamService } from '../bot/src/services/teamService';
dotenv.config()

async function resetAllowRanked() {
    await mongoose.connect(process.env.MONGO_URI || '')

    const teamsBulkWrites = []
    const teams = await Team.find({})
    for (const team of teams) {
        const name = teamService.validateTeamName(team.name) || `TEAM ${team.guildId}`
        teamsBulkWrites.push({
            updateOne: {
                filter: { guildId: team.guildId },
                update: { $set: { name, nameUpperCase: name.toUpperCase() } }
            }
        })
    }
    await Team.bulkWrite(teamsBulkWrites)

    const lineupsBulkWrites = []
    const lineups = await Lineup.find({})
    for (const lineup of lineups) {
        const name = teamService.validateTeamName(lineup.team.name) || `TEAM ${lineup.team.guildId}`
        lineupsBulkWrites.push({
            updateOne: {
                filter: { channelId: lineup.channelId },
                update: { $set: { 'team.name': name, 'team.nameUpperCase': name.toUpperCase() } }
            }
        })
    }
    await Lineup.bulkWrite(lineupsBulkWrites)
}

resetAllowRanked()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        process.exit()
    })

