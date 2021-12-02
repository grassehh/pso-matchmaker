const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Give information about your team'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const teamEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Team information`)
            .setTimestamp()
        teamEmbed.addField('Team name', team.name)
        teamEmbed.addField('Team region', team.region)
        await interaction.reply({
            embeds: [teamEmbed],
            ephemeral: true
        })
    },
};