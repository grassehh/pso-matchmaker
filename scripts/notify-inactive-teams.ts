import mongoose from 'mongoose';
import { Lineup } from '../bot/src/mongoSchema';
import dotenv = require('dotenv');
dotenv.config()

// const client = new Client({
//     intents: [
//         GatewayIntentBits.Guilds
//     ]
// })

async function notifyUpdate(): Promise<void> {
    // await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    let date = new Date();
    date.setDate(date.getDate() - 30);
    const lineups = await Lineup.find({ lastMatchDate: { "$lt": date } }, { channelId: 1 })
    console.log(lineups.length)
    // await Promise.all(lineups.map(async lineup => {
    //     const [channel] = await handle(client.channels.fetch(lineup.channelId))
    //     if (channel) {
    //         await handle((channel).send({ embeds: [updateEmbed] }))
    //     }
    // }))
}

notifyUpdate().finally(async () => {
    console.log("Notify inactive teams finished");
    await mongoose.disconnect();
    // client.destroy();
    process.exit();
})

