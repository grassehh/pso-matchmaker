const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cancel_challenge')
        .setDescription('Cancels the current challenge request (if any)'),
    async execute(interaction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (!challenge) {
            await interaction.reply({ content: "⛔ Your lineup is not currently challenging", ephemeral: true })
            return
        }
    
        await matchmakingService.cancelChallenge(interaction.client, interaction.user, challenge.id)
        await interaction.reply({ content: 'You have cancelled the challenge request', ephemeral: true })
    }
}