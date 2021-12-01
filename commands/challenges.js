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
        
        let lineup = teamService.retrieveLineup(team, interaction.channelId)
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
                reply = interactionUtils.createDecideChallengeReply(challenge)
            }
            await interaction.reply(reply)
            return
        }

        let lineupQueues = await matchmakingService.findAvailableLineupQueues(lineup.channelId, team.region)
        if (lineupQueues.length === 0) {
            await interaction.reply({
                embeds: [
                    new MessageEmbed()
                        .setColor('#0099ff')
                        .setDescription("No Team are currently seaching for a match")]
            })
        } else {
            let teamsActionRow = new MessageActionRow()
            let lineupQueuesBySize = new Map()
            for (lineupQueue of lineupQueues) {
                if (!lineupQueuesBySize.has(lineupQueue.lineup.size)) {
                    lineupQueuesBySize.set(lineupQueue.lineup.size, [])
                }
                lineupQueuesBySize.get(lineupQueue.lineup.size).push(lineupQueue)
            }

            let embeds = []
            for (let lineupSize of lineupQueuesBySize.keys()) {
                const lineupsEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(`Teams for ${lineupSize}v${lineupSize}`)
                    .setTimestamp()
                    .setFooter("Note: You can only challenge team with the same lineup size")

                let lineupQueuesForCurrentSize = lineupQueuesBySize.get(lineupSize)
                let i = 1
                for (let lineupQueue of lineupQueuesForCurrentSize) {
                    let lineupFieldName = `${lineupQueue.team.name}`
                    if (lineupQueue.lineup.name) {
                        lineupFieldName += ` *(${lineupQueue.lineup.name})*`
                    }                    
                    let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.user != null).length + ' players signed'
                    if (lineupQueue.lineup.roles.find(role => role.name === "GK")?.user == null) {
                        lineupFieldValue += ' **(no gk)**'
                    }
                    lineupsEmbed.addField(lineupFieldName, lineupFieldValue, i % 4 !== 0)
                    if (lineupQueue.lineup.size == lineup.size) {
                        teamsActionRow.addComponents(
                            new MessageButton()
                                .setCustomId(`challenge_${lineupQueue.id}`)
                                .setLabel(lineupFieldName)
                                .setEmoji('⚽')
                                .setStyle('PRIMARY')
                        )
                    }
                    i++
                }

                embeds.push(lineupsEmbed)
            }

            if (teamsActionRow.components.length === 0) {
                await interaction.reply({ embeds })
            } else {
                await interaction.reply({ embeds, components: [teamsActionRow] })
            }
        }
    },
};