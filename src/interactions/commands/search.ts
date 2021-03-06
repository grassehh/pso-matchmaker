import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Put your team in the matchmaking queue'),
    async execute(interaction: CommandInteraction) {
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
        if (lineup.isMixOrCaptains()) {
            await interaction.reply({ content: `⛔ Mix lineups are always visible in the matchmaking queue`, ephemeral: true })
            return
        }
        let currentQueuedLineup = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (currentQueuedLineup) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(currentQueuedLineup.lineup.size))
            return
        }

        if (!matchmakingService.isLineupAllowedToJoinQueue(lineup)) {
            interaction.reply({ content: '⛔ All outfield positions must be filled before searching', ephemeral: true })
            return
        }

        await interaction.deferReply();
        await matchmakingService.joinQueue(interaction.client, interaction.user, lineup)
        await interaction.editReply({ embeds: [interactionUtils.createInformationEmbed(interaction.user, '🔎 Your team is now searching for a team to challenge')] })
    }
} as ICommandHandler;