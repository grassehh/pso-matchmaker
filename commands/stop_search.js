const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop_search')
        .setDescription('Remove your team from the matchmaking queue'),
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
        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (!lineupQueue) {
            await interactionUtils.replyNotQueued(interaction)
            return
        }

        await matchmakingService.leaveQueue(interaction.client, lineupQueue)
        await interaction.reply(`Your team is no longer searching for a challenge`)
    }
};