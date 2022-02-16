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
        const team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
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

        if (lineup.isMixOrCaptains()) {
            await interaction.reply(reply)
            return
        }

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        let lineupStatusEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)

        if (challenge) {
            if (challenge.challengedTeam.lineup.isMix()) {
                lineupStatusEmbed.setTitle(`💬 You are challenging the mix ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)
            } else {
                if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                    lineupStatusEmbed.setTitle(`💬 Your are challenging ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)
                } else {
                    lineupStatusEmbed.setTitle(`💬 ${teamService.formatTeamName(challenge.initiatingTeam.lineup)} is challenging you`)
                        .setDescription(`Contact ${challenge.initiatingUser.mention} if you want to arrange further.`)
                }
            }
        } else if (lineupQueue) {
            lineupStatusEmbed.setTitle("🔎 Your are searching for a Team ...")
        } else {
            lineupStatusEmbed.setTitle("Your are not searching for a Team")
            lineupStatusEmbed.addField('Lineup size', `${lineup.size}v${lineup.size}`, true)
                .addField('Lineup name', lineup.name ? lineup.name : '*none*', true)
                .addField('Auto-search', `${lineup.autoSearch ? '**enabled**' : '*disabled*'}`, true)
        }

        reply.embeds = [lineupStatusEmbed]
        await interaction.reply(reply)
    }
};