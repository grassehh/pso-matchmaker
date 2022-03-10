const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Lineup, Team, Stats } = require('../mongoSchema');
const { handle } = require('../utils');
const { Client, Intents } = require('discord.js');
dotenv.config()

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS
  ]
})

async function cleanOrphans() {
  await client.login(process.env.TOKEN)
  await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
  await cleanOrphanLineups()
  await cleanOrphanTeams()
  // await cleanOrphanStats()
}

async function cleanOrphanLineups() {
  console.log('Cleaning orphan lineups')
  const channelIds = (await Lineup.aggregate([
    {
      '$group': {
        '_id': null,
        'channelIds': {
          '$addToSet': '$channelId'
        }
      }
    }
  ]))[0].channelIds

  let unknownChannelIds = []
  for (let channelId of channelIds) {
    const [channel] = await handle(client.channels.fetch(channelId))
    if (!channel) {
      unknownChannelIds.push(channelId)
    }
  }

  if (unknownChannelIds.length === 0) {
    console.log("No orphan lineups found")
    return
  }

  console.log(`${unknownChannelIds.length} orphan lineups to delete: ${unknownChannelIds}`)
  await Lineup.deleteMany({ 'channelId': { $in: unknownChannelIds } })
  console.log(`Orphan lineups deleted`)
}

async function cleanOrphanTeams() {
  console.log('Cleaning orphan teams')
  const guildIds = (await Team.aggregate([
    {
      '$group': {
        '_id': null,
        'guildIds': {
          '$addToSet': '$guildId'
        }
      }
    }
  ]))[0].guildIds

  let unknownGuildIds = []
  for (let guildId of guildIds) {
    const [guild] = await handle(client.guilds.fetch(guildId))
    if (!guild) {
      unknownGuildIds.push(guildId)
    }
  }

  if (unknownGuildIds.length === 0) {
    console.log("No orphan teams found")
    return
  }

  console.log(`${unknownGuildIds.length} orphan teams to delete: ${unknownGuildIds}`)
  await Team.deleteMany({ 'guildId': { $in: unknownGuildIds } })
  console.log(`Orphan teams deleted`)
}

async function cleanOrphanStats() {
  console.log('Cleaning orphan stats')
  const userIds = (await Stats.aggregate([
    {
      '$group': {
        _id: null,
        userIds: {
          $addToSet: '$userId',
        }
      }
    }
  ]))[0].userIds

  let unknownUserIds = []
  for (let userId of userIds) {
    const [user] = await handle(client.users.fetch(userId))
    if (!user) {
      unknownUserIds.push(userId)
    }
  }

  if (unknownUserIds.length === 0) {
    console.log("No orphan stats found")
    return
  }

  console.log(`${unknownUserIds.length} orphan stats to delete: ${unknownUserIds}`)
  await Stats.deleteMany({ 'userId': { $in: unknownGuildIds } })
  console.log(`Orphan stats deleted`)
}

cleanOrphans().then(async res => {
  await mongoose.disconnect()
  client.destroy()
  process.exit()
})

