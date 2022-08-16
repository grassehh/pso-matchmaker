import { BaseGuildTextChannel, ButtonInteraction } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaveLineup',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (!await teamService.leaveLineup(interaction.client, interaction.user, interaction.channel as BaseGuildTextChannel, lineup)) {
            await interaction.reply({ content: `⛔ You are not in the lineup`, ephemeral: true })
            return
        }

        if (!interaction.replied) {
            await interaction.update({ components: [] })
        }
    }
} as IButtonHandler