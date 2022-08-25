import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';
import { Stats } from '../bot/src/mongoSchema';
import { Region, regionService } from '../bot/src/services/regionService';
import dotenv = require('dotenv');
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
})

const CHUNK_SIZE = 15

function sliceIntoChunks<T>(arr: T[], chunkSize: number): [T[]] {
    const res: [T[]] = [[]];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

async function resetStats(): Promise<void> {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    const regionData = regionService.getRegionData(Region.EUROPE)
    console.log(`Updating member tier role for region ${regionData.label}`)
    const guild = await client.guilds.fetch(regionData.guildId)
    if (guild) {
        const regionStats = await Stats.find({ region: regionData.region })
        const chunkedStats = sliceIntoChunks(regionStats, CHUNK_SIZE)
        let chunk = 0
        for (const statsChunk of chunkedStats) {
            console.log(`Updating member chunk ${chunk}/${chunkedStats.length}`)
            const members = await guild.members.fetch({ user: statsChunk.map(stats => stats.userId) })

            await Promise.all(members.map(async (member) => {
                if (member) {
                    const stats = statsChunk.find(stats => stats.userId === member.id)!
                    await regionService.updateMemberTierRole(regionData.region, member, stats)
                }
            }))
            chunk++
        }
    }
}

resetStats().finally(async () => {
    console.log("Reset tier roles finished");
    await mongoose.disconnect();
    client.destroy()
    process.exit();
})

