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

        if (lineup.isMixOrCaptains()) {
            await interaction.reply({ content: '⛔ Mix lineups cannot see the list of challenges', ephemeral: true })
            return
        }

        let lineupQueues = await matchmakingService.findAvailableLineupQueues(team.region, lineup.channelId, lineup.size, team.guildId)
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

        const teamLineupsEmbed = new MessageEmbed()
            .setColor('#4752c4')
            .setTitle(`Teams for ${lineup.size}v${lineup.size}`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        const teamLineupQueues = lineupQueues.filter(lineupQueue => !lineupQueue.lineup.isMix())
        let teamsActionComponents = []
        if (teamLineupQueues.length === 0) {
            teamLineupsEmbed.setDescription(`No Team available for ${lineup.size}v${lineup.size}`)
        } else {
            for (let lineupQueue of teamLineupQueues) {
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no GK)**'
                }
                teamLineupsEmbed.addField(teamService.formatTeamName(lineupQueue.lineup, false), lineupFieldValue)
            }
            let teamsActionRow = new MessageActionRow()
            if (teamLineupQueues.length < 6) {
                for (let lineupQueue of teamLineupQueues) {
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
                for (let lineupQueue of teamLineupQueues) {
                    challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue.id }])
                }
                teamsActionRow.addComponents(challengesSelectMenu)
            }
            teamsActionComponents = [teamsActionRow]
        }

        const mixLineupsEmbed = new MessageEmbed()
            .setColor('#4f545c')
            .setTitle(`Mixes for ${lineup.size}v${lineup.size}`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        const mixLineupQueues = lineupQueues.filter(lineupQueue => lineupQueue.lineup.isMix())
        let mixesActionComponents = []
        if (mixLineupQueues.length === 0) {
            mixLineupsEmbed.setDescription(`No Mix available for ${lineup.size}v${lineup.size}`)
        } else {
            for (let lineupQueue of mixLineupQueues) {
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no GK)**'
                }
                mixLineupsEmbed.addField(teamService.formatTeamName(lineupQueue.lineup, false), lineupFieldValue)
            }
            let mixesActionRow = new MessageActionRow()
            if (mixLineupQueues.length < 6) {
                for (let lineupQueue of mixLineupQueues) {
                    mixesActionRow.addComponents(
                        new MessageButton()
                            .setCustomId(`challenge_${lineupQueue.id}`)
                            .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                            .setStyle('SECONDARY')
                    )
                }            
            } else {
                const challengesSelectMenu = new MessageSelectMenu()
                    .setCustomId(`challenge_select`)
                    .setPlaceholder('Select a Mix to challenge')
                for (let lineupQueue of mixLineupQueues) {
                    challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue.id }])
                }
                mixesActionRow.addComponents(challengesSelectMenu)
            }
            mixesActionComponents = [mixesActionRow]
        }


        await interaction.channel.send({ embeds: [mixLineupsEmbed], components: mixesActionComponents })
        await interaction.reply({ embeds: [teamLineupsEmbed], components: teamsActionComponents })
    }
}