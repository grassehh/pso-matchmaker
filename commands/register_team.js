const { SlashCommandBuilder } = require('@discordjs/builders');
const { Team } = require('../mongoSchema');
const { retrieveTeam } = require('../services');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register_team')
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
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)

        if (!team) {
            new Team({
                guildId: interaction.guildId,
                name: interaction.options.getString('team_name'),
                region: interaction.options.getString('team_region')
            }).save()
            await interaction.reply({
                content: 'Your team has been registered ! You can now register lineups in your channels using the /setup_lineup command',
                ephemeral: true
            })
        } else {
            await interaction.reply({
                content: `You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
        }
    },
};