import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('cancel_challenge')
        .setDescription('Cancels the current challenge request (if any)'),
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

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (!challenge) {
            await interaction.reply({ content: "⛔ Your lineup is not currently challenging", ephemeral: true })
            return
        }

        await interaction.deferReply({ ephemeral: true })
        await matchmakingService.cancelChallenge(interaction.client, interaction.user, challenge._id.toString())
        await interaction.editReply({ content: 'You have cancelled the challenge request' })
    }
} as ICommandHandler