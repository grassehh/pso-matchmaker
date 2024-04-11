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
    await mongoose.connect(process.env.MONGO_URI || '')

    let updateEmbed = new MessageEmbed()
        .setColor('#566573')
        .setTitle(`✅ Maintenance finished !`)
        .setDescription('The maintenance is now finished. Bot is up and running again. Have fun !')
        .setTimestamp()

    const lienups = await Lineup.find({}, { channelId: 1 })
    await Promise.all(lienups.map(async lineup => {
        const [channel] = await handle(client.channels.fetch(lineup.channelId))
        if (channel) {
            await handle(channel.send({ embeds: [updateEmbed] }))
        }
    }))
}

notifyUpdate().finally(async res => {
    console.log("Notify update finished")
    await mongoose.disconnect()
    client.destroy()
    process.exit()
})

