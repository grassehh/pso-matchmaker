const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue, Team } = require('../mongoSchema');
const { retrieveTeam, createLineupComponents, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup, replyAlreadyQueued } = require('../services');
const { deleteLineup } = require('../services/teamService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_lineup')
        .setDescription('Deletes this lineup from this channel'),
    async execute(interaction) {
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

        await deleteLineup(interaction.guildId, interaction.channelId)
        await interaction.reply('✅ Lineup deleted from this channel');
    },
};