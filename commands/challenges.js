const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageEmbed, MessageButton } = require('discord.js');
const { retrieveTeam, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup, createCancelChallengeReply, createDecideChallengeReply } = require('../services');
const { findAvailableLineupQueues, findChallengeByChannelId } = require('../services/matchmakingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Display the teams looking for a match, with the same lineup size'),
    async execute(interaction) {
        let challenge = await findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            let reply
            if (challenge.initiatingTeam.lineup.channelId == interaction.channelId) {
                reply = createCancelChallengeReply(challenge)
            } else {
                reply = createDecideChallengeReply(challenge)
            }
            await interaction.reply(reply)
            return
        }

        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }

        let lineup = retrieveLineup(interaction.channelId, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }

        let lineupQueues = await findAvailableLineupQueues(lineup.channelId, team.region)
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
                    let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.user != null).length + ' players signed'
                    if (lineupQueue.lineup.name) {
                        lineupFieldValue += ` (lineup ${lineupQueue.lineup.name})`
                    }
                    lineupsEmbed.addField(`Team '${lineupQueue.team.name}'`, lineupFieldValue, i % 4 !== 0)
                    if (lineupQueue.lineup.size == lineup.size) {
                        teamsActionRow.addComponents(
                            new MessageButton()
                                .setCustomId(`challenge_${lineupQueue.id}`)
                                .setLabel(`Challenge '${lineupQueue.team.name}'`)
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