const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear_lineup')
        .setDescription('Clears every roles in this lineup'),
    async execute(interaction) {
        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interactionUtils.replyAlreadyChallenging(interaction, challenge)
            return
        }

        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }
        let lineup = teamService.retrieveLineup(team, interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        let currentQueuedLineup = await LineupQueue.findOne({ 'lineup.channelId': interaction.channelId })
        if (currentQueuedLineup) {
            interactionUtils.replyAlreadyQueued(interaction, currentQueuedLineup.lineup.size)
            return
        }

        await teamService.clearLineup(interaction.guildId, interaction.channelId)
        lineup = await teamService.findLineupByChannelId(interaction.guildId, interaction.channelId)
        await interaction.reply({content: '✅ Lineup has been cleared !', components: interactionUtils.createLineupComponents(lineup)})
    },
};