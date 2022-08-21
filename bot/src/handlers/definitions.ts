import fs = require('fs')
import path = require('path')
import { Collection, MessageComponentInteraction } from "discord.js";
import { IButtonHandler } from './buttonHandler';
import { ICommandHandler } from './commandHandler';
import { IComponentHandler } from './componentHandler';
import { ISelectMenuHandler } from './selectMenuHandler';

const fileFilter = (file: string) => {
    const fileExtension = path.extname(file)
    return [".js", ".ts"].some(ext => ext === fileExtension) && !file.endsWith(".d.ts")
}

//Fetch and push commands into the client
export const commands = new Collection<string, ICommandHandler>()
const commandFiles = fs.readdirSync(path.resolve(__dirname, '../interactions/commands')).filter(fileFilter)
for (const file of commandFiles) {
    const command = require(`../interactions/commands/${file}`).default as ICommandHandler;
    commands.set(command.data.name, command);
}

//Fetch and push component interaction handlers into the client
export const componentInteractions: Array<IComponentHandler<MessageComponentInteraction>> = []
const buttonFiles = fs.readdirSync(path.resolve(__dirname, '../interactions/buttons')).filter(fileFilter)
for (const file of buttonFiles) {
    const button = require(`../interactions/buttons/${file}`).default as IButtonHandler;
    componentInteractions.push(button)
}
const selectMenuFiles = fs.readdirSync(path.resolve(__dirname, '../interactions/selectMenus')).filter(fileFilter)
for (const file of selectMenuFiles) {
    const selectMenu = require(`../interactions/selectMenus/${file}`).default as ISelectMenuHandler;
    componentInteractions.push(selectMenu)
}