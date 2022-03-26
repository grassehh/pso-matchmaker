const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');
const authorizationService = require("../../services/authorizationService");
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_team')
        .setDescription('Deletes this team'),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
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
        await interaction.reply({ content: '🛑 This will delete your team and all associated lineups', components: [deleteTeamActionRow], ephemeral: true })
    },
};