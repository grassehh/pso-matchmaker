import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { matchmakingService } from "../../services/matchmakingService";

export default {
    customId: 'challenge_',
    async execute(interaction: ButtonInteraction) {
        await matchmakingService.challenge(interaction, interaction.customId.substring(10))
    }
} as IButtonHandler