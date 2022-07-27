import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM } from "../../services/teamService";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix_captains')
            .setDescription('Setup a mix lineup with captains picking')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The number of players in each team')
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
            ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const lineupSize = interaction.options.getInteger("size")!
        const lineup = teamService.createLineup(interaction.channelId, lineupSize, undefined, true, team, LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed(interaction.user, '✅ New mix captains lineup configured'))     
        await interaction.reply(reply);
    }
} as ICommandHandler;