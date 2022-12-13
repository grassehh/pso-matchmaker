import fs from 'fs';
import path = require('path')
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { ICommandHandler } from '../bot/src/handlers/commandHandler'
import dotenv from 'dotenv';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

dotenv.config()

const fileFilter = (file: string) => {
    const fileExtension = path.extname(file)
    return [".js", ".ts"].some(ext => ext === fileExtension) && !file.endsWith(".d.ts")
}
const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];
const commandFiles = fs.readdirSync(path.resolve(__dirname, '../bot/src/interactions/commands')).filter(fileFilter);
for (const file of commandFiles) {
    const command = require(`../bot/src/interactions/commands/${file}`).default as ICommandHandler;
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN as string);

let putCommandsRoute
if (process.env.GUILD_ID) {
    console.log("GUILD_ID found in env. Updating guild commands.")
    putCommandsRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID as string, process.env.GUILD_ID as string)
} else {
    console.log("GUILD_ID not found in env. Updating whole Discord commands.")
    putCommandsRoute = Routes.applicationCommands(process.env.CLIENT_ID as string)
}
rest.put(putCommandsRoute, { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);