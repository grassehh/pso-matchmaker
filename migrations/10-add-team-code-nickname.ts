import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';
import { Team } from '../bot/src/mongoSchema';
import { Region, regionService } from '../bot/src/services/regionService';
import { TeamType } from '../bot/src/services/teamService';
import dotenv = require('dotenv');
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

async function addTeamCodeNickname() {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '')
    const teams = await Team.find({ region: Region.EUROPE, type: TeamType.CLUB })
    const regionDiscord = await regionService.getRegionGuild(client, Region.EUROPE)
    let i = 1
    for (const team of teams) {
        console.log(`Checking team ${i}/${teams.length}`)
        const allPlayers = team.players.concat(team.captains)
        let j = 1
        for (const player of allPlayers) {
            console.log(`       Checking player ${j}/${allPlayers.length}`)
            await regionService.removeTeamCodeFromNickName(player.id, regionDiscord)
            await regionService.addTeamCodeToNickname(player.id, team, regionDiscord)
            j++
        }
        i++
    }
}

addTeamCodeNickname()
    .catch(console.error)
    .finally(async () => {
        console.log("Migration finished")
        await mongoose.disconnect()
        client.destroy()
    })

