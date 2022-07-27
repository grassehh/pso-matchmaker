import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Displays the status of your lineup'),
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ There is a team draft in progress', ephemeral: true })
            return
        }

        const lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId) || undefined
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)

        if (lineup.isMixOrCaptains()) {
            await interaction.reply(reply)
            return
        }

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        const lineupInfoEmbed = new MessageEmbed()
            .setTitle(`Lineup information`)
            .setColor('#566573')
            .addField('Lineup size', `${lineup.size}v${lineup.size}`, true)
            .addField('Lineup name', lineup.name ? lineup.name : '*none*', true)
            .addField('Auto-search', `${lineup.autoSearch ? '**enabled**' : '*disabled*'}`, true)
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user.username}` })

        let lineupStatusEmbed = new MessageEmbed()
            .setColor('#566573')

        if (challenge) {
            if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                const challengedTeamLineup = (await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId))!
                let description = `**${teamService.formatTeamName(challengedTeamLineup)}**`
                description += `\n${challengedTeamLineup.roles.filter(role => role.user != null).length} players signed`
                if (!teamService.hasGkSigned(challengedTeamLineup)) {
                    description += ' **(no GK)**'
                }
                lineupStatusEmbed.setTitle(`💬 You are challenging a ${challengedTeamLineup.isMix() ? 'mix' : 'team'}`)
                    .setDescription(description)
            } else {
                const initiatingTeamLineup = (await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId))!
                let description = `**${teamService.formatTeamName(initiatingTeamLineup)}**`
                description += `\n${initiatingTeamLineup.roles.filter(role => role.user != null).length} players signed`
                if (!teamService.hasGkSigned(initiatingTeamLineup)) {
                    description += ' **(no GK)**'
                }
                description += `\n\n*Contact ${challenge.initiatingUser.mention} for more information*`
                lineupStatusEmbed.setTitle(`🤝 A team wants to play against you`)
                    .setDescription(description)
            }
        } else if (lineupQueue) {
            lineupStatusEmbed.setTitle("🔎 You are searching for a team to challenge ...")
        } else {
            lineupStatusEmbed.setTitle("😴 You are not searching for a team")
        }

        if (reply.embeds) {
            reply.embeds.splice(0, 0, lineupStatusEmbed)
            reply.embeds.splice(0, 0, lineupInfoEmbed)
        } else {
            reply.embeds = [lineupInfoEmbed, lineupStatusEmbed]
        }
        await interaction.reply(reply)
    }
} as ICommandHandler;