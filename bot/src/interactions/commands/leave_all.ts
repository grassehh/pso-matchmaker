import { SlashCommandBuilder } from "@discordjs/builders";
import { BaseGuildTextChannel, ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import { handle } from "../../utils";

export default {
    data: new SlashCommandBuilder()
        .setName('leave_all')
        .setDescription('Remove you from every lineup you are signed in'),
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

        const lineups = await teamService.findAllLineupsByUserId(interaction.user.id)
        if (lineups.length === 0) {
            await interaction.reply({ content: `You are not signed in any lineup`, ephemeral: true })
            return
        }

        await Promise.all(lineups.map(async lineup => {
            const [channel] = await handle(interaction.client.channels.fetch(lineup.channelId))
            if (!(channel instanceof BaseGuildTextChannel)) {
                return
            }

            await teamService.leaveLineup(interaction, channel, lineup)
        }))

        await interaction.reply({ content: `You have been removed from all lineups`, ephemeral: true })
    }
} as ICommandHandler