import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ILineup } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('lineup_clear')
        .setDescription('Clears every roles in this lineup'),
    async execute(interaction: ChatInputCommandInteraction) {
        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply(interactionUtils.createReplyAlreadyChallenging(challenge))
            return
        }

        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId) || undefined
        if (!lineup.isNotTeam() && lineupQueue) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(lineupQueue.lineup.size))
            return
        }

        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ Captains are currently picking the teams', ephemeral: true })
            return
        }

        lineup = await teamService.clearLineup(interaction.channelId, [1, 2]) as ILineup
        await matchmakingService.clearLineupQueue(interaction.channelId, [1, 2])
        let reply = await interactionUtils.createReplyForLineup(lineup, lineupQueue)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed('✅ Lineup has been cleared !', interaction.user))
        await interaction.reply(reply);
    },
} as ICommandHandler