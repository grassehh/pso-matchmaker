import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('stop_search')
        .setDescription('Remove your team from the matchmaking queue'),
    async execute(interaction: ChatInputCommandInteraction) {
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
        if (lineup.isMixOrCaptains()) {
            await interaction.reply({ content: `⛔ You cannot remove a mix from the matchmaking queue`, ephemeral: true })
            return
        }
        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (challenge) {
            await interaction.reply(interactionUtils.createReplyAlreadyChallenging(challenge))
            return
        }
        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (!lineupQueue) {
            await interaction.reply(interactionUtils.createReplyNotQueued())
            return
        }

        await interaction.deferReply();
        await matchmakingService.leaveQueue(lineupQueue)
        await interaction.editReply({ embeds: [interactionUtils.createInformationEmbed(interaction.user, '😴 Your team is no longer searching for a challenge')] })
    }
} as ICommandHandler;