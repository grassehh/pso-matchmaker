const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup, replyAlreadyQueued, replyAlreadyChallenging, createLineupReply } = require('../services');
const { findChallengeByChannelId } = require('../services/matchmakingService');
const { clearLineup } = require('../services/teamService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear_lineup')
        .setDescription('Clears every roles in this lineup'),
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

        let currentQueuedLineup = await LineupQueue.findOne({ 'lineup.channelId': interaction.channelId })
        if (currentQueuedLineup) {
            replyAlreadyQueued(interaction, currentQueuedLineup.lineup.size)
            return
        }

        await clearLineup(team, interaction.channelId)
        await interaction.reply(createLineupReply(lineup, interaction.user.id))
    },
};