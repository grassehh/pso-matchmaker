import fs = require('fs')
import path = require('path')
import dotenv = require('dotenv');
import { Client, Collection, Intents, MessageComponentInteraction } from 'discord.js';
import { matchmakingService } from './beans';
import { ICommandHandler } from './handlers/commandHandler';
import { IComponentHandler } from './handlers/componentHandler';
import { IButtonHandler } from './handlers/buttonHandler';
import { ISelectMenuHandler } from './handlers/selectMenuHandler';
import { schedule } from 'node-cron'
import mongoose from 'mongoose';
// __dirname = path.resolve();

dotenv.config()

process.on('unhandledRejection', (error: any) => {
	console.error('Unhandled promise rejection:', error);
});

const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_PRESENCES
	],
	allowedMentions: {
		parse: ['roles', 'users', 'everyone'],
		repliedUser: false
	}
})

//Fetch and push commands into the client
export const commands = new Collection<string, ICommandHandler>()
const commandFiles = fs.readdirSync(path.resolve(__dirname, 'interactions/commands'));
for (const file of commandFiles) {
	const command = require(`./interactions/commands/${file}`).default as ICommandHandler;
	commands.set(command.data.name, command);
}

//Fetch and push component interaction handlers into the client
export const componentInteractions: Array<IComponentHandler<MessageComponentInteraction>> = []
const buttonFiles = fs.readdirSync(path.resolve(__dirname, 'interactions/buttons'));
for (const file of buttonFiles) {
	const button = require(`./interactions/buttons/${file}`).default as IButtonHandler;
	componentInteractions.push(button)
}
const selectMenuFiles = fs.readdirSync(path.resolve(__dirname, 'interactions/selectMenus'));
for (const file of selectMenuFiles) {
	const selectMenu = require(`./interactions/selectMenus/${file}`).default as ISelectMenuHandler;
	componentInteractions.push(selectMenu)
}

//Fetch and registers all event handlers
const eventFiles = fs.readdirSync(path.resolve(__dirname, 'events'))
for (const file of eventFiles) {
	const event = require(`./events/${file}`).default;
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

schedule('*/5 * * * *', () => matchmakingService.updateBanList(client).catch(console.error));

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