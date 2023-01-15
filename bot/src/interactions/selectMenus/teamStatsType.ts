import { InteractionUpdateOptions, AnySelectMenuInteraction } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    customId: 'team_stats_scope_select_',
    async execute(interaction: AnySelectMenuInteraction) {
        const split = interaction.customId.split('_')
        const guildId = split[4]
        const team = await teamService.findTeamByGuildId(guildId) as ITeam
        const region: Region = interaction.values[0] as Region
        await interaction.update((await interactionUtils.createTeamStatsReply(team, region)) as InteractionUpdateOptions)
    }
} as ISelectMenuHandler