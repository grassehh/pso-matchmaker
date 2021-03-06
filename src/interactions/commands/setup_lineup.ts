import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC } from "../../services/teamService";

export default {
    data:
        new SlashCommandBuilder()
            .setName('setup_lineup')
            .setDescription('Set the size of the team lineup to use for the selected channel')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of the team lineup')
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '2', value: 2 },
                    { name: '3', value: 3 },
                    { name: '4', value: 4 },
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                    { name: '8', value: 8 },
                    { name: '9', value: 9 },
                    { name: '10', value: 10 },
                    { name: '11', value: 11 }
                )
            )
            .addBooleanOption(option => option.setName('auto_search')
                .setRequired(false)
                .setDescription('Indicates if this lineup should automatically search for a team once it is filled')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId) || undefined
        if (lineupQueue) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(lineupQueue.lineup.size))
            return
        }

        const lineupSize = interaction.options.getInteger("size")!
        const autoSearch = interaction.options.getBoolean("auto_search") || false
        const lineup = teamService.createLineup(interaction.channelId, lineupSize, undefined, autoSearch, team, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC)
        await teamService.upsertLineup(lineup)

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed(interaction.user, '??? New lineup configured'))        
        await interaction.reply(reply);
    }
} as ICommandHandler