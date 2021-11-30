const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { retrieveTeam, replyTeamNotRegistered } = require('../services');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Give information about your team'),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        
        if (!team) {
            await replyTeamNotRegistered(interaction)
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