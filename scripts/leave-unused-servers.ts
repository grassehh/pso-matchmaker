const dotenv = require('dotenv');
import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';
import { Team } from '../bot/src/mongoSchema';
dotenv.config()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
})

async function leaveUnusedServers() {
  await client.login(process.env.TOKEN)
  await mongoose.connect(process.env.MONGO_URI || '')
  const guilds = client.guilds.cache.values()
  for (let guild of guilds) {
    const team = await Team.findOne({ guildId: guild.id })
    const joinedAt = guild.members.me?.joinedAt
    if (!team && joinedAt && (Math.abs(joinedAt.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000) > 7)) {
      console.log(`Guild ${guild.id} (${guild.name}) joined at ${joinedAt.toISOString()} has no team registered: leaving`)
      await guild.leave()
    }
  }
}

leaveUnusedServers().finally(async () => {
  await mongoose.disconnect()
  client.destroy()
  process.exit()
})

