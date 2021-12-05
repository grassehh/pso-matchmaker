const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");

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
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }
        
        const newName = interaction.options.getString('name')
        const duplicatedTeam = await teamService.findTeamByRegionAndName(team.region, newName)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `❌ Another team is already registered under the name **'${newName}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        team.name = newName
        await team.save()
        await interaction.reply(`✅ Your new team name is **${team.name}**`)
    },
};