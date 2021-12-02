const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { Stats } = require('../mongoSchema');
const statsService = require("../services/statsService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription(`Display your own stats or another player's stats`)
        .addStringOption(option => option.setName('player_name')
            .setRequired(false)
            .setDescription('The name of the player you want to see the stats')),
    async execute(interaction) {

        let playerName = interaction.options.getString('player_name')
        let user = interaction.user
        if (playerName) {
            let matchingUsers = await interaction.guild.members.search({ query: playerName })
            console.log(matchingUsers.keys())
            if (matchingUsers.size == 0) {
                const statsEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(`❌ Player **${playerName}** not found`)
                    .setTimestamp()
                await interaction.reply({ embeds: [statsEmbed] })
                return
            } else {
                user = matchingUsers.at(0)
            }
        }

        let stats = await statsService.findStatsByUserId(interaction.user.id)
        if (!stats) {
            stats = new Stats({
                numberOfGames: 0
            })
        }

        const statsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`${interaction.user.tag} stats`)
            .setTimestamp()
        statsEmbed.addField('⚽ Games played', stats.numberOfGames + '')

        interaction.reply({ embeds: [statsEmbed] })
    },
};