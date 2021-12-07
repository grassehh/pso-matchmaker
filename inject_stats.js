const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv');
const { Permissions } = require('discord.js');

dotenv.config()

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

let putCommandsRoute
if (process.env.GUILD_ID) {
    putCommandsRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
} else {
    putCommandsRoute = Routes.applicationCommands(process.env.CLIENT_ID)
}
rest.put(putCommandsRoute, { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);