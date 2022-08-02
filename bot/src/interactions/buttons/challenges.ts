import { ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    customId: 'challenges_',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const ranked = interaction.customId.split('_')[1] === 'ranked'

        await matchmakingService.listChallenges(interaction, lineup, ranked)
    }
} as IButtonHandler