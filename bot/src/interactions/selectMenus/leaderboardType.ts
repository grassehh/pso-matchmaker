import { InteractionUpdateOptions, SelectMenuInteraction } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { interactionUtils, StatsScope, StatsType } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaderboard_scope_select',
    async execute(interaction: SelectMenuInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const statsScope: StatsScope = parseInt(interaction.values[0])
        const statsType: StatsType = parseInt(interaction.customId.split('_')[3])
        const reply = await interactionUtils.createLeaderboardReply(interaction, team, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, statsScope, statsType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as ISelectMenuHandler