import { Client, EmbedBuilder, GatewayIntentBits, TextChannel } from 'discord.js';
import mongoose from 'mongoose';
import { Lineup } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
import { handle } from '../bot/src/utils';
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

async function notifyUpdate(): Promise<void> {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    let updateEmbed = new EmbedBuilder()
        .setColor('#566573')
        .setTitle(`📢 **IMPORTANT** !`)
        .setDescription('A new version of the bot has been deployed. Please if you encounter any issue, recreate your lineups (using **/setup_lineup**, **/setup_mix**, **/setup_mix_captains** commands). \nSorry for the inconvenience.')
        .setTimestamp()

    const lienups = await Lineup.find({}, { channelId: 1 })
    await Promise.all(lienups.map(async lineup => {
        const [channel] = await handle(client.channels.fetch(lineup.channelId))
        if (channel) {
            await handle((channel as TextChannel).send({ embeds: [updateEmbed] }))
        }
    }))
}

notifyUpdate().finally(async () => {
    console.log("Notify update finished");
    await mongoose.disconnect();
    client.destroy();
    process.exit();
})

