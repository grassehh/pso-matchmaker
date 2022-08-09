import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { TeamLogoDisplay, teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Displays the status of your lineup'),
    async execute(interaction: ChatInputCommandInteraction) {
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
        let reply = await interactionUtils.createReplyForLineup(lineup, lineupQueue)

        if (lineup.isMixOrCaptains()) {
            await interaction.reply(reply)
            return
        }

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        const lineupInfoEmbed = new EmbedBuilder()
            .setTitle(`Lineup information`)
            .setColor('#566573')
            .addFields([
                { name: 'Lineup size', value: `${lineup.size}v${lineup.size}`, inline: true },
                { name: 'Lineup name', value: lineup.name ? lineup.name : '*none*', inline: true },
                { name: 'Allow ranked', value: `${lineup.allowRanked ? '**enabled**' : '*disabled*'}`, inline: true },
                { name: 'Auto-matchmaking', value: `${lineup.autoMatchmaking ? '**enabled**' : '*disabled*'}`, inline: true },
                { name: 'Auto-search', value: `${lineup.autoSearch ? '**enabled**' : '*disabled*'}`, inline: true }
            ])

        let lineupStatusEmbed = new EmbedBuilder()
            .setColor('#566573')

        if (challenge) {
            if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                const challengedTeamLineup = (await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId))!
                let description = challengedTeamLineup.prettyPrintName(TeamLogoDisplay.LEFT, challengedTeamLineup.team.verified)
                description += `\n${challengedTeamLineup.roles.filter(role => role.user != null).length} players signed`
                if (!teamService.hasGkSigned(challengedTeamLineup)) {
                    description += ' **(no GK)**'
                }
                lineupStatusEmbed.setTitle(`💬 You are challenging a ${challengedTeamLineup.isMix() ? 'mix' : 'team'}`)
                    .setDescription(description)
            } else {
                const initiatingTeamLineup = (await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId))!
                let description = initiatingTeamLineup.prettyPrintName(TeamLogoDisplay.LEFT, initiatingTeamLineup.team.verified)
                description += `\n${initiatingTeamLineup.roles.filter(role => role.user != null).length} players signed`
                if (!teamService.hasGkSigned(initiatingTeamLineup)) {
                    description += ' **(no GK)**'
                }
                description += `\n\n*Contact ${challenge.initiatingUser.mention} for more information*`
                lineupStatusEmbed.setTitle(`🤝 A team wants to play against you`)
                    .setDescription(description)
            }
        } else if (lineupQueue) {
            lineupStatusEmbed.setTitle(`🔎 You are searching for a **${lineupQueue.ranked ? 'Ranked' : 'Casual'}** match to play ...`)
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