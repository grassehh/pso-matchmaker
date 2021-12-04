const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription(`Display your own stats or another player's stats`)
        .addStringOption(option => option.setName('player_name')
            .setRequired(false)
            .setDescription('The name of the player you want to see the stats')),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        let playerName = interaction.options.getString('player_name')
        let user = interaction.user
        if (playerName) {
            let matchingUsers = await interaction.guild.members.search({ query: playerName })
            if (matchingUsers.size == 0) {
                const statsEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(`❌ Player **${playerName}** not found`)
                    .setTimestamp()
                interaction.reply({ embeds: [statsEmbed], ephemeral: true})
                return
            } else {
                user = matchingUsers.at(0).user
            }
        }

        const globalStatsComponent = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId(`stats_global_select_${user.id}`)
                .setPlaceholder('Stats Type')
                .addOptions([
                    {
                        label: '🌎 Global Stats',
                        value: 'stats_global_value'
                    },
                    {
                        label: '👕 Team Stats',
                        value: 'stats_team_value',
                    }
                ])
        )

        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, user)
        interaction.reply({ embeds: statsEmbeds, components: [globalStatsComponent], ephemeral: true })
    }
};