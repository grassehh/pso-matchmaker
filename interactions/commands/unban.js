const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const { getUserIdFromMention } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a player from using the bot in this team')
        .addStringOption(option => option.setName('player_mention')
            .setRequired(true)
            .setDescription('The mention of the player to unban. For example: @Player')),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }
        const playerMention = interaction.options.getString('player_mention')
        const userId = getUserIdFromMention(playerMention)
        if (userId) {
            const res = await teamService.deleteBanByUserIdAndGuildId(userId, team.guildId)
            if (res.deletedCount === 0) {
                await interaction.reply({ content: `⛔ User '${playerMention}' is not banned`, ephemeral: true })
                return
            }
            await interaction.reply({ content: `✅ Player ${playerMention} is now unbanned`, ephemeral: true })
            return
        }

        await interaction.reply({ content: `⛔ User '${playerMention}' not found`, ephemeral: true })
    }
}