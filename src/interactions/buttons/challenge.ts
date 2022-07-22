import { ButtonInteraction } from "discord.js";
import { matchmakingService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'challenge_',
    async execute(interaction: ButtonInteraction) {
        await matchmakingService.challenge(interaction, interaction.customId.substring(10))
    }
} as IButtonHandler