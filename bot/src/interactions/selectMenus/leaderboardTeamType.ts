import { InteractionUpdateOptions, AnySelectMenuInteraction } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { GameType, interactionUtils, StatsType } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
import { TeamType } from "../../services/teamService";

export default {
    customId: 'leaderboard_team_type_select',
    async execute(interaction: AnySelectMenuInteraction) {
        const teamTypeValue = interaction.values[0]
        const teamType: TeamType | undefined = teamTypeValue === 'undefined' ? undefined : parseInt(teamTypeValue)
        const region: Region = interaction.customId.split('_')[4] as Region
        const reply = await interactionUtils.createLeaderboardReply(interaction, { page: 0, pageSize: DEFAULT_LEADERBOARD_PAGE_SIZE, region, statsType: StatsType.TEAMS, gameType: GameType.TEAM_AND_MIX, teamType })
        await interaction.update(reply as InteractionUpdateOptions)
    }
} as ISelectMenuHandler