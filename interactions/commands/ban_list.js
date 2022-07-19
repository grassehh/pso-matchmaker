const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban_list')
        .setDescription('Display a list of banned players'),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const banListEmbed = await interactionUtils.createBanListEmbed(interaction.client, interaction.guildId)

        await interaction.reply({ embeds: [banListEmbed], ephemeral: true })
    }
}