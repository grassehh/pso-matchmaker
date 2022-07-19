const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const constants = require("../../constants");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team_name')
        .setDescription('Let you edit the name of your team')
        .addStringOption(option => option.setName('name')
            .setRequired(true)
            .setDescription('The new name of your team')
        ),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }
        
        const newName = interaction.options.getString('name')
        if (!teamService.validateTeamName(newName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${constants.MAX_TEAM_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }
        
        const duplicatedTeam = await teamService.findTeamByRegionAndName(team.region, newName)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${newName}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateTeamNameByGuildId(team.guildId, newName)
        await interaction.reply(`✅ Your new team name is **${newName}**`)
    },
};