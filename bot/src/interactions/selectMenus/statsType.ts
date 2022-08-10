import { SelectMenuInteraction } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";

export default {
    customId: 'stats_type_select_',
    async execute(interaction: SelectMenuInteraction) {
        let split = interaction.customId.split('_')
        let userId = split[3]
        const region: Region = interaction.values[0] as Region
        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, userId, region)
        await interaction.update({ embeds: statsEmbeds })
    }
} as ISelectMenuHandler