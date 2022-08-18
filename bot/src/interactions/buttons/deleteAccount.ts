import { ButtonInteraction } from "discord.js"
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { userService } from "../../services/userService";

export default {
    customId: 'delete_account_',
    async execute(interaction: ButtonInteraction) {
        const choice = interaction.customId!.split('_')[2]
        if (choice === 'yes') {
            await userService.deleteUser(interaction.user.id)
            await interaction.update({ embeds: [interactionUtils.createInformationEmbed('✅ Your account has been deleted')], components: [] })
            return
        }

        await interaction.update({ content: 'Easy peasy ! Nothing has been deleted', components: [] })
    }
} as IButtonHandler