import { ButtonInteraction, InteractionUpdateOptions } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { GameType, interactionUtils, StatsScope, StatsType } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaderboard_page_',
    async execute(interaction: ButtonInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const split = interaction.customId.split('_')
        const customIdPage = split[2]
        let page
        if (customIdPage === 'last') {
            page = -1
        } else if (customIdPage === 'first') {
            page = 0
        } else {
            page = parseInt(customIdPage)
        }

        const statsScope: StatsScope = parseInt(split[3])
        const statsType: StatsType = parseInt(split[4])
        const gameType: GameType = parseInt(split[5])
        const reply = await interactionUtils.createLeaderboardReply(interaction, team, { page, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, statsScope, statsType, gameType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as IButtonHandler