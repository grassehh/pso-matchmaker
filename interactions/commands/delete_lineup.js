const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const matchmakingService = require("../../services/matchmakingService");
const authorizationService = require("../../services/authorizationService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_lineup')
        .setDescription('Deletes this lineup from this channel'),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interactionUtils.replyAlreadyChallenging(interaction, challenge)
            return
        }

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)
        await teamService.deleteLineup(interaction.channelId)
        await interaction.reply('✅ Lineup deleted from this channel');
    },
};