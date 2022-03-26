const { CommandInteraction } = require("discord.js")
const dotenv = require('dotenv');
const { Client, Intents } = require('discord.js');
const mongoose = require('mongoose');
const { Bans, LineupQueue } = require('../mongoSchema');
const { InteractionType } = require("discord-api-types");

let discordClient

beforeAll(async () => {
    dotenv.config()
    discordClient = new Client({
        intents: [
            Intents.FLAGS.GUILDS
        ]
    })
    await discordClient.login(process.env.TOKEN)
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
})

afterAll(async () => {
    await mongoose.disconnect()
    discordClient.destroy()
})

beforeEach(async () => {
    // await Bans.deleteMany()
    // await Challenges.deleteMany()
    // await LineupQueue.deleteMany()
    // await Lineups.deleteMany()
    // await Match.deleteMany()
    // await Stats.deleteMany()
    // await Teams.deleteMany()
});

describe("Nominal cases", () => {
    test('Should display team info team', async () => {
        await discordClient.emit(
            "interactionCreate",
            new CommandInteraction(
                discordClient,
                {
                    id: '',
                    applicationId: '916659022722138122',
                    channelId: '946132453398024212',
                    commandId: '929817720587948091',
                    commandName: 'info',
                    deferred: false,
                    ephemeral: null,
                    guildId: '914820495076122685',
                    user: discordClient.user
                }
            )
        )
    })
})


// {
//     "type": 2,
//     "token": "A_UNIQUE_TOKEN",
//     "member": {
//         "user": {
//             "id": "53908232506183680",
//             "username": "Mason",
//             "avatar": "a_d5efa99b3eeaa7dd43acca82f5692432",
//             "discriminator": "1337",
//             "public_flags": 131141
//         },
//         "roles": ["539082325061836999"],
//         "premium_since": null,
//         "permissions": "2147483647",
//         "pending": false,
//         "nick": null,
//         "mute": false,
//         "joined_at": "2017-03-13T19:19:14.040000+00:00",
//         "is_pending": false,
//         "deaf": false
//     },
//     "id": "786008729715212338",
//     "guild_id": "290926798626357999",
//     "guild_locale": "en-US",
//     "locale": "en-US",
//     "data": {
//         "options": [{
//             "name": "cardname",
//             "value": "The Gitrog Monster"
//         }],
//         "name": "cardsearch",
//         "id": "771825006014889984"
//     },
//     "channel_id": "645027906669510667"
// }