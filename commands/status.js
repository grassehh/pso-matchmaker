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
            .setColor('#566573')
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)

        if (challenge) {
            if (challenge.challengedTeam.lineup.isMix()) {
                lineupStatusEmbed.setTitle(`💬 You are challenging the mix ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)
            } else {
                if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                    let description = `**${teamService.formatTeamName(challenge.challengedTeam.lineup)}**`
                    description += `\n${challenge.challengedTeam.lineup.roles.filter(role => role.user != null).length} players signed`
                    if (!teamService.hasGkSigned(challenge.challengedTeam.lineup)) {
                        description += ' **(no GK)**'
                    }
                    lineupStatusEmbed.setTitle(`💬 You are challenging a team`)
                        .setDescription(description)

                } else {
                    let description = `**${teamService.formatTeamName(challenge.initiatingTeam.lineup)}**`
                    description += `\n${challenge.initiatingTeam.lineup.roles.filter(role => role.user != null).length} players signed`
                    if (!teamService.hasGkSigned(challenge.initiatingTeam.lineup)) {
                        description += ' **(no GK)**'
                    }
                    description += `\n\n*Contact ${challenge.initiatingUser.mention} for more information*`
                    lineupStatusEmbed.setTitle(`🤝 A team wants to play against you`)
                        .setDescription(description)
                }
            }
        } else if (lineupQueue) {
            lineupStatusEmbed.setTitle("🔎 You are searching for a team to challenge ...")
        } else {
            lineupStatusEmbed.setTitle("😴 You are not searching for a team")
            lineupStatusEmbed.addField('Lineup size', `${lineup.size}v${lineup.size}`, true)
                .addField('Lineup name', lineup.name ? lineup.name : '*none*', true)
                .addField('Auto-search', `${lineup.autoSearch ? '**enabled**' : '*disabled*'}`, true)
        }

        reply.embeds = [lineupStatusEmbed]
        await interaction.reply(reply)
    }
};