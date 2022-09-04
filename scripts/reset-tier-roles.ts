import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';
import { DEFAULT_RATING, MINIMUM_MATCHES_BEFORE_RANKED } from '../bot/src/constants';
import { PlayerStats } from '../bot/src/mongoSchema';
import { Region, regionService } from '../bot/src/services/regionService';
import { handle } from '../bot/src/utils';
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

    const region = Region.EUROPE
    console.log(`Updating member tier role for region ${region}`)
    const regionGuild = await regionService.getRegionGuild(client, region)
    if (regionGuild) {
        const regionStats = await PlayerStats.find({ region: region, numberOfRankedGames: { $gte: MINIMUM_MATCHES_BEFORE_RANKED } })
        const chunkedStats = sliceIntoChunks(regionStats, CHUNK_SIZE)
        let chunk = 0
        for (const statsChunk of chunkedStats) {
            console.log(`Updating member chunk ${chunk}/${chunkedStats.length}`)
            const members = await regionGuild.members.fetch({ user: statsChunk.map(stats => stats.userId) })

            await Promise.all(members.map(async (member) => {
                if (member) {
                    const stats = statsChunk.find(stats => stats.userId === member.id)!
                    const activityRoleId = regionService.getActivityRoleId(stats.numberOfRankedGames)
                    let newRating = DEFAULT_RATING
                    if (activityRoleId === process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID) {
                        newRating = 1000
                    } else if (activityRoleId === process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID) {
                        newRating = 1200
                    }
                    await PlayerStats.updateOne(
                        { 'userId': member.id, 'region': region },
                        {
                            $set: {
                                numberOfRankedWins: 0,
                                numberOfRankedDraws: 0,
                                numberOfRankedLosses: 0,
                                totalNumberOfRankedWins: 0,
                                totalNumberOfRankedDraws: 0,
                                totalNumberOfRankedLosses: 0,
                                rating: newRating
                            }
                        }
                    )

                    const tierRoleId = regionService.getTierRoleId(region, newRating)
                    if (!tierRoleId || member.roles.cache.some(role => role.id === tierRoleId)) {
                        return
                    }

                    await handle(member.roles.remove(regionService.getAllTierRoleIds(region)))
                    await handle(member.roles.add(tierRoleId))
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

