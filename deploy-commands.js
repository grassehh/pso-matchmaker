const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv');

dotenv.config()

const commands = [
    new SlashCommandBuilder().setName('info')
        .setDescription('Give information about your team'),

    new SlashCommandBuilder().setName('register_team')
        .setDescription('Register your team against PSO matchmaker so you can start using the matchmaking')
        .addStringOption(option => option.setName('team_name')
            .setRequired(true)
            .setDescription('The name of your team')
        )
        .addStringOption(option => option.setName('team_region')
            .setRequired(true)
            .setDescription('The region of your team')
            .addChoice('Europe', 'EU')
            .addChoice('North America', 'NA')
            .addChoice('South America', 'SA')
            .addChoice('Korea', 'AS')
        ),

    new SlashCommandBuilder().setName('team_name')
        .setDescription('Let you edit the name of your team')
        .addStringOption(option => option.setName('name')
            .setRequired(true)
            .setDescription('The new name of your team')
        ),

    new SlashCommandBuilder().setName('setup_lineup')
        .setDescription('Set the size of the team lineup to use for the selected channel')
        .addIntegerOption(option => option.setName('size')
            .setRequired(true)
            .setDescription('The size of the team lineup')
            .addChoice('1', 1)
            .addChoice('2', 2)
            .addChoice('3', 3)
            .addChoice('4', 4)
            .addChoice('5', 5)
            .addChoice('6', 6)
            .addChoice('7', 7)
            .addChoice('8', 8)
            .addChoice('9', 9)
            .addChoice('10', 10)
            .addChoice('11', 11)
        ),

    new SlashCommandBuilder().setName('search')
        .setDescription('Put your team in the matchmaking queue'),

    new SlashCommandBuilder().setName('stop_search')
        .setDescription('Remove your team from the matchmaking queue'),

    new SlashCommandBuilder().setName('lineup')
        .setDescription('Displays the current lineup'),

    new SlashCommandBuilder().setName('clear_lineup')
        .setDescription('Clears every roles in this lineup'),

    new SlashCommandBuilder().setName('challenges')
        .setDescription('Display the teams looking for a match, with the same lineup size'),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);