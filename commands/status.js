const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const matchmakingService = require("../services/matchmakingService");
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Displays the status of your lineup'),
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

        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ There is a team draft in progress', ephemeral: true })
            return
        }

        const lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)

        if (!lineup.isMixOrCaptains()) {
            const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
            let lineupStatusEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTimestamp()
                .setFooter(`Author: ${interaction.user.username}`)
                .addField('Lineup size', `${lineup.size}v${lineup.size}`, true)
                .addField('Lineup name', lineup.name ? lineup.name : '*none*', true)
                .addField('Auto-search', `${lineup.autoSearch ? '**enabled**' : '*disabled*'}`, true)

            if (challenge) {
                if (challenge.challengedTeam.lineup.isMix()) {
                    lineupStatusEmbed.setTitle(`💬 Your lineup is challenging the mix ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)
                } else {
                    lineupStatusEmbed.setTitle(`💬 Your lineup has sent a challenge request to ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)
                }
            } else {

                if (lineupQueue) {
                    lineupStatusEmbed.setTitle("🔎 Your lineup is searching for a Team ...")
                } else {
                    lineupStatusEmbed.setTitle("Your lineup is not searching for a Team")
                }
            }
            reply.embeds = [lineupStatusEmbed]

        }

        await interaction.reply(reply)
    }
};