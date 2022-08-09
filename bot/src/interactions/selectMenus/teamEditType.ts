import { SelectMenuInteraction } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService, TeamType } from "../../services/teamService";

export default {
    customId: 'team_edit_type_',
    async execute(interaction: SelectMenuInteraction) {
        const split = interaction.customId.split('_')
        const type: TeamType = parseInt(interaction.values[0])
        const guildId = split[3]

        let team = await teamService.findTeamByGuildId(guildId) as ITeam
        const wasVerified = team.verified
        team = await teamService.updateTeamType(guildId, type) as ITeam
        await interaction.reply(interactionUtils.createTeamManagementReply(interaction, team))
        if (wasVerified) {
            teamService.notifyNoLongerVerified(interaction.client, team)
        }
    }
} as ISelectMenuHandler