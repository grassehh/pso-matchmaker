const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');
const { LineupQueue } = require('../mongoSchema');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_team')
        .setDescription('Deletes this team'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
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