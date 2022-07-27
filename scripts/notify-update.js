const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { handle } = require('../dist/utils');
const { Client, Intents, MessageEmbed } = require('discord.js');
const { Lineup } = require('../dist/mongoSchema');
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
        .setTitle(`📢 **IMPORTANT** !`)
        .setDescription('A new version of the bot has been deployed. Please if you encounter any issue, recreate your lineups (using **/setup_lineup**, **/setup_mix**, **/setup_mix_captains** commands). \nSorry for the inconvenience.')
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

