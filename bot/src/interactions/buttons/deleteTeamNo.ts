import { ButtonInteraction } from "discord.js"
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'delete_team_no_',
    async execute(interaction: ButtonInteraction) {
        await interaction.update({ content: 'Easy peasy ! Nothing has been deleted', components: [] })
    }
} as IButtonHandler