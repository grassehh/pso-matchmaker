import { SelectMenuInteraction } from "discord.js";
import { matchmakingService } from "../../beans";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";

export default {
    customId: 'select_challenge',
    async execute(interaction: SelectMenuInteraction) {
        await matchmakingService.challenge(interaction, interaction.values[0])
    }
} as ISelectMenuHandler