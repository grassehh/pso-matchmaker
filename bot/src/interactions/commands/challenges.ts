import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Display the teams looking for a match, with the same lineup size'),
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
            await interaction.reply({ content: '⛔ Mix lineups cannot see the list of challenges', ephemeral: true })
            return
        }

        await matchmakingService.listChallenges(interaction, lineup, lineup.allowRanked)
    }
} as ICommandHandler