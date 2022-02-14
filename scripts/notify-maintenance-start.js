const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { handle } = require('../utils');
const { Client, Intents, MessageEmbed } = require('discord.js');
const { Lineup } = require('../mongoSchema');
dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS
    ]
})


async function notifyUpdate() {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    let updateEmbed = new MessageEmbed()
        .setColor('#566573')
        .setTitle(`🚧 Maintenance in progress ...`)
        .setDescription('A maintenance is in progress. This will only take a few secondes or minutes.\nThe bot will not be accessible in the meantime. Sorry for the inconvenience.')
        .setTimestamp()

    const lienups = await Lineup.find({}, { channelId: 1 })
    await Promise.all(lienups.map(async lineup => {
        const [channel] = await handle(client.channels.fetch(lineup.channelId))
        if (channel) {
            await handle(channel.send({ embeds: [updateEmbed] }))
        }
    }))
}

notifyUpdate().then(async res => {
    console.log("Notify update finished")
    await mongoose.disconnect()
    process.exit()
})

