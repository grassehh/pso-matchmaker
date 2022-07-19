const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const { getUserIdFromMention } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a player from using the bot in this team')
        .addStringOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The mention (@...) or the id of the player to ban. For example: @Player or 123456789012345678')),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const player = interaction.options.getString('player')
        let userId = player.includes('@') ? getUserIdFromMention(player) : player

        const user = await interaction.client.users.resolve(userId)
        if (!user) {
            await interaction.reply({ content: `⛔ User '${player}' not found`, ephemeral: true })
            return
        }

        const res = await teamService.deleteBanByUserIdAndGuildId(user.id, team.guildId)
        if (res.deletedCount === 0) {
            await interaction.reply({ content: `⛔ User **${user.username}** is not banned`, ephemeral: true })
            return
        }
        await interaction.reply({ content: `✅ Player **${user.username}** is now unbanned`, ephemeral: true })
        return
    }
}