import { InteractionUpdateOptions, SelectMenuInteraction } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";

export default {
    customId: 'stats_scope_select_',
    async execute(interaction: SelectMenuInteraction) {
        const split = interaction.customId.split('_')
        const userId = split[3]
        const user = interaction.client.users.resolve(userId)!
        const region: Region = interaction.values[0] as Region
        await interaction.update((await interactionUtils.createPlayerStatsReply(user, region)) as InteractionUpdateOptions)
    }
} as ISelectMenuHandler