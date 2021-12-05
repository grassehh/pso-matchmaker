const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageEmbed, MessageButton } = require('discord.js');
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Display the teams looking for a match, with the same lineup size'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            let reply
            if (challenge.initiatingTeam.lineup.channelId == interaction.channelId) {
                reply = interactionUtils.createCancelChallengeReply(challenge)
            } else {
                reply = interactionUtils.createDecideChallengeReply(interaction, challenge)
            }
            await interaction.reply(reply)
            return
        }

        let lineupQueues = await matchmakingService.findAvailableLineupQueues(team.region, lineup.channelId, lineup.size)
        if (lineupQueues.length === 0) {
            await interaction.reply({
                embeds: [
                    new MessageEmbed()
                        .setColor('#0099ff')
                        .setDescription(`No Team is currently seaching for a ${lineup.size}v${lineup.size} match 😪`)
                ]
            })
        } else {
            let teamsActionRow = new MessageActionRow()
            let embeds = []
            const lineupsEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`Teams for ${lineup.size}v${lineup.size}`)
                .setTimestamp()
                .setFooter(`Author: ${interaction.user.username}`)

            let i = 1
            for (let lineupQueue of lineupQueues) {
                let lineupFieldName = teamService.formatTeamName(lineupQueue.lineup)
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no gk)**'
                }
                lineupsEmbed.addField(lineupFieldName, lineupFieldValue, i % 4 !== 0)
                teamsActionRow.addComponents(
                    new MessageButton()
                        .setCustomId(`challenge_${lineupQueue.id}`)
                        .setLabel(lineupFieldName)
                        .setEmoji('⚽')
                        .setStyle('PRIMARY')
                )
                i++
            }

            embeds.push(lineupsEmbed)

            if (teamsActionRow.components.length === 0) {
                await interaction.reply({ embeds })
            } else {
                await interaction.reply({ embeds, components: [teamsActionRow] })
            }
        }
    },
};