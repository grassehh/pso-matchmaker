const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');
const { LineupQueue, Team } = require('../mongoSchema');
const { retrieveTeam, createLineupComponents, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup, replyAlreadyQueued } = require('../services');
const { deleteLineup, deleteTeam } = require('../services/teamService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_team')
        .setDescription('Deletes this team'),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }

        let currentQueuedLineup = await LineupQueue.findOne({ 'lineup.channelId': interaction.channelId })
        if (currentQueuedLineup) {
            replyAlreadyQueued(interaction, currentQueuedLineup.lineup.size)
            return
        }

        const deleteTeamActionRow = new MessageActionRow()
        deleteTeamActionRow.addComponents(
            new MessageButton()
                .setCustomId(`delete_team_yes_${team.guildId}`)
                .setLabel(`Yes`)
                .setStyle('DANGER'),
            new MessageButton()
                .setCustomId(`delete_team_no_${team.guildId}`)
                .setLabel(`No`)
                .setStyle('PRIMARY')
        )
        await interaction.reply({ content: '🛑 This will delete you team and all its lineups', components: [deleteTeamActionRow], ephemeral: true })
    },
};