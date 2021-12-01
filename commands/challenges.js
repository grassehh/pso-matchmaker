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
        let teamsActionRow = new MessageActionRow()
        const teamsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Challenging Teams (Current lineup is ${lineup.size}v${lineup.size})`)
            .setTimestamp()
        if (lineupQueues.length === 0) {
            teamsEmbed.setDescription("No Team are currently seaching for a match")
        } else {
            for (let lineupQueue of lineupQueues) {
                teamsEmbed.addField(`Team '${lineupQueue.team.name}'`, `${lineupQueue.lineup.size}v${lineupQueue.lineup.size}`)
                if (lineupQueue.lineup.size == lineup.size) {
                    teamsActionRow.addComponents(
                        new MessageButton()
                            .setCustomId(`challenge_${lineupQueue.id}`)
                            .setLabel(`Challenge '${lineupQueue.team.name}'`)
                            .setEmoji('⚽')
                            .setStyle('PRIMARY')
                    )
                }
            }
            teamsEmbed.setFooter("Note: You can only challenge team with the same lineup size")
        }

        if (teamsActionRow.components.length === 0) {
            await interaction.reply({ embeds: [teamsEmbed] })
        } else {
            await interaction.reply({ embeds: [teamsEmbed], components: [teamsActionRow] })
        }
    },
};