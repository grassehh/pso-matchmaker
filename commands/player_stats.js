const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player_stats')
        .setDescription(`Display your own stats or another player's stats`)
        .addStringOption(option => option.setName('player_name')
            .setRequired(false)
            .setDescription('The name of the player you want to see the stats')),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
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
                await interaction.reply({ embeds: [statsEmbed], ephemeral: true})
                return
            } else {
                user = matchingUsers.at(0).user
            }
        }

        const statsTypeComponent = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId(`stats_type_select_${user.id}`)
                .setPlaceholder('Stats Type')
                .addOptions([
                    {
                        label: '🌎 Global Stats',
                        value: 'global'
                    },                    
                    {
                        label: '⛺ Region Stats',
                        value: `region,${team.region}`
                    },
                    {
                        label: '👕 Team Stats',
                        value: 'team',
                    }
                ])
        )

        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, user.id)
        await interaction.reply({ embeds: statsEmbeds, components: [statsTypeComponent], ephemeral: true })
    }
};