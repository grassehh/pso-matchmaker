const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team_region')
        .setDescription('Let you edit the region of your team')
        .addStringOption(option => option.setName('region')
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
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const newRegion = interaction.options.getString('region')
        const duplicatedTeam = await teamService.findTeamByRegionAndName(newRegion, team.name)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `❌ Another team is already registered under the name **'${team.name}'** in the **${newRegion}** region. Please change your team neam using the /team_name command or select another region.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateTeamRegionByGuildId(team.guildId, newRegion)
        await interaction.reply(`✅ Your new team region is **${team.region}**`)
    },
};