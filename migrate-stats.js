const fs = require('fs').promises;
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { handle } = require('./utils');
const { Client, Intents } = require('discord.js');
const csv = require('async-csv');
const { Stats } = require('./mongoSchema');
dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS
    ]
})

async function incrementGamesPlayed(guildId, userId, lineupSize, games) {
    Stats.updateOne(
        { guildId, userId, lineupSize },
        {
            $inc: { numberOfGames: games }
        },
        { upsert: true }
    )
}


async function migrateStats() {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    const csvString = await fs.readFile('./stats.csv', 'utf-8');
    const rows = await csv.parse(csvString, { headers: false });
    console.log(`Processing row`)
    const promises = rows.map(async row => {
        console.log(`Processing row ${row}`)
        const [member, error] = await handle(guild.members.search({ query: row[0] }))
        if (member && member.size === 1) {
            await incrementGamesPlayed(guild.id, member.at(0).id, 5, row[1])
        } else {
            console.log(error)
        }
    })
    return await Promise.all(promises)
}


migrateStats().then(async res => {
    console.log("Migration finished")
    await mongoose.disconnect()
    process.exit()
})

