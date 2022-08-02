import { ButtonInteraction, InteractionUpdateOptions } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils, StatsScope, StatsType } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaderboard_page_last_',
    async execute(interaction: ButtonInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const split = interaction.customId.split('_')
        const statsScope: StatsScope = parseInt(split[3])
        const statsType: StatsType = parseInt(split[4])
        const reply = await interactionUtils.createLeaderboardReply(interaction, team, { page: -1, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, statsScope, statsType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as IButtonHandler