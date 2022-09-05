import mongoose from 'mongoose';
import { statsService } from '../bot/src/services/statsService';
import dotenv = require('dotenv');
import { Client, GatewayIntentBits } from 'discord.js';
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

async function endSeason(): Promise<void> {
    await client.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    await statsService.endSeason(client)
}

endSeason().finally(async () => {
    console.log("Season ended");
    await mongoose.disconnect();
    client.destroy()
    process.exit();
})

