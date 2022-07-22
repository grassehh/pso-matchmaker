import { SelectMenuInteraction } from "discord.js";
import { interactionUtils } from "../../beans";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";

export default {
    customId: 'stats_type_select_',
    async execute(interaction: SelectMenuInteraction) {
        let split = interaction.customId.split('_')
        let userId = split[3]
        const statsType = interaction.values[0]
        let guildId
        if (statsType === 'team') {
            guildId = interaction.guildId
        }
        let region
        if (statsType.startsWith('region')) {
            region = statsType.split(',')[1]
        }
        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, userId, region)
        await interaction.update({ embeds: statsEmbeds })
    }
} as ISelectMenuHandler