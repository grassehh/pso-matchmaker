const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, createLineupComponents, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup, replyAlreadyQueued, replyAlreadyChallenging } = require('../services');
const { findChallengeByGuildId } = require('../services/matchmakingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear_lineup')
        .setDescription('Clears every roles in this lineup'),
    async execute(interaction) {
        let challenge = await findChallengeByGuildId(interaction.guildId)
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

        lineup.roles.forEach(role => {
            role.user = null
        });
        await team.save()
        await interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) });
    },
};