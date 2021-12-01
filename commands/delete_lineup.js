const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue, Team } = require('../mongoSchema');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_lineup')
        .setDescription('Deletes this lineup from this channel'),
    async execute(interaction) {
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

        await teamService.deleteLineup(interaction.guildId, interaction.channelId)
        await interaction.reply('✅ Lineup deleted from this channel');
    },
};