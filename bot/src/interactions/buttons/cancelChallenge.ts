import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { matchmakingService } from "../../services/matchmakingService";

export default {
    customId: 'cancel_challenge_',
    async execute(interaction: ButtonInteraction) {
        const challengeId = interaction.customId.substring(17);
        await interaction.update({ components: [] })
        await matchmakingService.cancelChallenge(interaction.client, interaction.user, challengeId)
    }
} as IButtonHandler