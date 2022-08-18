import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'delete_team_',
    async execute(interaction: ButtonInteraction) {
        const choice = interaction.customId!.split('_')[2]
        if (choice === 'yes') {
            await teamService.deleteTeam(interaction.guildId!)
            await interaction.update({ embeds: [interactionUtils.createInformationEmbed('✅ Your team has been deleted', interaction.user)], components: [] })
            return
        }

        await interaction.update({ content: 'Easy peasy ! Nothing has been deleted', components: [] })
    }
} as IButtonHandler