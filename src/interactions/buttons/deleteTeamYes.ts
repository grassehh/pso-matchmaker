import { ButtonInteraction } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'delete_team_yes_',
    async execute(interaction: ButtonInteraction) {
        await matchmakingService.deleteChallengesByGuildId(interaction.guildId!)
        await matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId!)
        await teamService.deleteLineupsByGuildId(interaction.guildId!)
        await teamService.deleteBansByGuildId(interaction.guildId!)
        await teamService.deleteTeam(interaction.guildId!)
        await interaction.update({ embeds: [interactionUtils.createInformationEmbed(interaction.user, '✅ Your team has been deleted')], components: [] })
    }
} as IButtonHandler