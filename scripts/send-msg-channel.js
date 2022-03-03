const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Client, Intents, MessageEmbed } = require('discord.js');
dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS
    ]
})

async function sendMessage() {
    await client.login(process.env.TOKEN)
    const channel = await client.channels.fetch('917826929678250067')
    await channel.send('Hello world')
}

sendMessage().then(async res => {
    console.log("Message sent")
    await mongoose.disconnect()
    process.exit()
})

