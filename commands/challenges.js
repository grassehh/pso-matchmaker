const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageEmbed, MessageButton, MessageSelectMenu } = require('discord.js');
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

        if (lineup.isMix) {
            await interaction.reply({ content: '⛔ Mix lineups cannot see the list of challenges', ephemeral: true })
            return
        }

        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            let reply
            if (challenge.initiatingTeam.lineup.channelId == interaction.channelId) {
                reply = interactionUtils.createCancelChallengeReply(interaction, challenge)
            } else {
                reply = interactionUtils.createDecideChallengeReply(interaction, challenge)
            }
            await interaction.reply(reply)
            return
        }

        let lineupQueues = await matchmakingService.findAvailableLineupQueues(team.region, lineup.channelId, lineup.size, lineup.visibility)
        if (lineupQueues.length === 0) {
            await interaction.reply({
                embeds: [
                    new MessageEmbed()
                        .setColor('#0099ff')
                        .setDescription(`No Team is currently seaching for a ${lineup.size}v${lineup.size} match 😪`)
                ]
            })
            return
        }

        const lineupsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Teams for ${lineup.size}v${lineup.size}`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        for (let lineupQueue of lineupQueues) {
            let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
            if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                lineupFieldValue += ' **(no gk)**'
            }
            lineupsEmbed.addField(teamService.formatTeamName(lineupQueue.lineup, false), lineupFieldValue)
        }

        let teamsActionRow = new MessageActionRow()

        if (lineupQueues.length < 6) {
            for (let lineupQueue of lineupQueues) {
                teamsActionRow.addComponents(
                    new MessageButton()
                        .setCustomId(`challenge_${lineupQueue.id}`)
                        .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                        .setStyle('PRIMARY')
                )
            }
        } else {
            const challengesSelectMenu = new MessageSelectMenu()
                .setCustomId(`challenge_select`)
                .setPlaceholder('Select a Team to challenge')
            for (let lineupQueue of lineupQueues) {
                challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue.id }])
            }
            teamsActionRow.addComponents(challengesSelectMenu)
        }

        await interaction.reply({ embeds: [lineupsEmbed], components: [teamsActionRow] })
    }
}