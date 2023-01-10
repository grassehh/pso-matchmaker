import fs = require('fs')
import path = require('path')
import dotenv = require('dotenv');
import { Client, GatewayIntentBits } from "discord.js";
import mongoose from 'mongoose';
import { schedule } from 'node-cron';
import { matchmakingService } from './services/matchmakingService';
import { teamService } from './services/teamService';

dotenv.config()

process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled promise rejection:', error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    allowedMentions: {
        parse: ['roles', 'users', 'everyone'],
        repliedUser: false
    }
})

const fileFilter = (file: string) => {
    const fileExtension = path.extname(file)
    return [".js", ".ts"].some(ext => ext === fileExtension) && !file.endsWith(".d.ts")
}
//Fetch and registers all event handlers
const eventFiles = fs.readdirSync(path.resolve(__dirname, 'events')).filter(fileFilter)
for (const file of eventFiles) {
    const event = require(`./events/${file}`).default;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args).catch(console.error));
    } else {
        client.on(event.name, (...args) => event.execute(...args).catch(console.error));
    }
}

schedule('0 0 * * *', async () => await teamService.notifyAndPurgeInactiveTeams(client).catch(console.error));

schedule('*/5 * * * *', async () => await matchmakingService.updateBansListChannel(client).catch(console.error));

let makingMatches = false
schedule('*/10 * * * * *', async () => {
    if (makingMatches) {
        return
    }
    makingMatches = true
    await matchmakingService.makeMatches(client).catch(console.error).finally(() => makingMatches = false)
});

console.log("Logging into discord...")
client.login(process.env.TOKEN)
    .then(() => console.log("Logged In"))
    .catch(console.error)

function closeResources() {
    console.log("Closing connections...")
    mongoose.disconnect()
    client.destroy()
}

process.on('SIGINT', () => {
    closeResources()
    process.exit()
})

process.on('exit', () => {
    closeResources()
})