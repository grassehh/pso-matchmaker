import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';
import { Team } from '../bot/src/mongoSchema';
import { Region, regionService } from '../bot/src/services/regionService';
import dotenv = require('dotenv');
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

async function addTeamCodeNickname() {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    const teams = await Team.find({ region: Region.EUROPE })
    const regionDiscord = await client.guilds.fetch(regionService.getRegionData(Region.EUROPE).guildId)
    let i = 1
    for (const team of teams) {
        console.log(`Checking team ${i}/${teams.length}`)
        const allPlayers = team.players.concat(team.captains)
        let j = 1
        for (const player of allPlayers) {
            console.log(`       Checking player ${j}/${allPlayers.length}`)
            await regionService.addTeamCodeToNickName(player.id, team.code, regionDiscord)
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

