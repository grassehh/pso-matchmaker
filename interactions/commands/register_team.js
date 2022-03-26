const { SlashCommandBuilder } = require('@discordjs/builders');
const { Team } = require('../../mongoSchema');
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const constants = require("../../constants")

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
            .addChoice('East Asia', 'AS')
        ),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (team) {
            await interaction.reply({
                content: `⛔ You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
            return
        }
        
        const name = interaction.options.getString('team_name')
        if (!teamService.validateTeamName(name)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${constants.MAX_TEAM_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        const region = interaction.options.getString('team_region')
        const duplicatedTeam = await teamService.findTeamByRegionAndName(region, name)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${name}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        await new Team({
            guildId: interaction.guildId,
            name: interaction.options.getString('team_name'),
            region: interaction.options.getString('team_region')
        }).save()
        await interaction.reply({
            content: '✅ Your team has been registered ! You can now register lineups in your channels using the /setup_lineup command',
            ephemeral: true
        })
    }
}