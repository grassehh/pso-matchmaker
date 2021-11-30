const fs = require('fs')
const { Client, Collection, Intents, MessageActionRow, MessageEmbed, MessageButton } = require('discord.js');
const mongoose = require('mongoose')
const { Team, Lineup, LineupQueue, PlayerRole } = require('./mongoSchema.js')
const dotenv = require('dotenv');
const { retrieveLineup } = require('./services.js');

dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
})

//Fetch and push commands into the client
client.commands = new Collection()
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'))
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

//Fetch and registers all even handlers
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.TOKEN)