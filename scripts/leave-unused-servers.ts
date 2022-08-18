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
  await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
  const guilds = client.guilds.cache.values()
  for (let guild of guilds) {
    console.log(`Checking guild with id ${guild.id}`)
    const team = await Team.findOne({ guildId: guild.id })
    if (!team) {
      console.log(`guild with id ${guild.id} has no team registered: leaving`)
      await guild.leave()
    } else {
      console.log(`guild with id ${guild.id} has a team registered: staying`)
    }
  }
}

leaveUnusedServers().finally(async () => {
  await mongoose.disconnect()
  client.destroy()
  process.exit()
})

