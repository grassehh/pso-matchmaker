const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, replyTeamNotRegistered, retrieveLineup, replyLineupNotSetup, replyAlreadyChallenging } = require('../services');
const { findChallengeByChannelId } = require('../services/matchmakingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop_search')
        .setDescription('Remove your team from the matchmaking queue'),
    async execute(interaction) {
        let challenge = await findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await replyAlreadyChallenging(interaction, challenge)
            return
        }
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }
        let lineup = retrieveLineup(interaction.channelId, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }

        await LineupQueue.deleteOne({ 'lineup.channelId': interaction.channelId }).exec()
        await interaction.reply(`✅ Your team is now removed from the queue`)
    },
};