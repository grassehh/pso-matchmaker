import { AnySelectMenuInteraction, User } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService, TeamType, TeamTypeHelper } from "../../services/teamService";

export default {
    customId: 'team_edit_type_',
    async execute(interaction: AnySelectMenuInteraction) {
        const split = interaction.customId.split('_')
        const type: TeamType = parseInt(interaction.values[0])
        const guildId = split[3]

        let team = await teamService.findTeamByGuildId(guildId) as ITeam
        const allUsersId = new Set(team.captains.map(c => c.id).concat(team.players.map(p => p.id)))
        let unallowedUsers: User[] = []
        for (const userId of allUsersId) {
            const userTeams = await teamService.findTeams(userId)
            if (userTeams.filter(t => t.guildId !== guildId).filter(t => t.type === type).length > 0) {
                const user = await interaction.client.users.fetch(userId)
                unallowedUsers.push(user)
            }
        }

        if (unallowedUsers.length > 0) {
            await interaction.reply({ content: `⛔ You cannot change your team to a **${TeamTypeHelper.toString(type)}** because the following players are already in a **${TeamTypeHelper.toString(type)}**: ${unallowedUsers.map(u => u.username).join(', ')}`, ephemeral: true })
            return
        }

        const wasVerified = team.verified
        team = await teamService.updateTeamType(guildId, type) as ITeam
        await interaction.reply(interactionUtils.createTeamManagementReply(interaction, team))
        if (wasVerified) {
            teamService.notifyNoLongerVerified(interaction.client, team, 'Team type changed')
        }
    }
} as ISelectMenuHandler