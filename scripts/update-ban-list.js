const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Client, Intents } = require('discord.js');
const interactionUtils = require('../services/interactionUtils');
dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS
    ]
})

async function updateBanList() {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    const banListEmbed = await interactionUtils.createBanListEmbed(client, process.env.PSO_EU_DISCORD_GUILD_ID)
    const channel = await client.channels.fetch(process.env.PSO_EU_DISCORD_BANS_CHANNEL_ID)
    const messages = await channel.messages.fetch({ limit: 1 })
    if (messages.size === 0) {
        await channel.send({ embeds: [banListEmbed] })
    } else {
        await messages.at(0).edit({ embeds: [banListEmbed] }).catch(
            async (e) => { await channel.send({ embeds: [banListEmbed] }) }
        )
    }
}

updateBanList()
    .catch(e => { console.log(e) })
    .finally(async res => {
        console.log("Message sent")
        await mongoose.disconnect()
        client.destroy()
        process.exit()
    })

