import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    customId: 'delete_team_yes_',
    async execute(interaction: ButtonInteraction) {
        await matchmakingService.deleteChallengesByGuildId(interaction.guildId!)
        await matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId!)
        await teamService.deleteLineupsByGuildId(interaction.guildId!)
        await teamService.deleteBansByGuildId(interaction.guildId!)
        await teamService.deleteTeam(interaction.guildId!)
        await interaction.update({ embeds: [interactionUtils.createInformationEmbed('✅ Your team has been deleted', interaction.user)], components: [] })
    }
} as IButtonHandler