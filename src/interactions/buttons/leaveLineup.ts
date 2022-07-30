import { BaseGuildTextChannel, ButtonInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'leaveLineup',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        await teamService.leaveLineup(interaction, interaction.channel as BaseGuildTextChannel, lineup)

        if (!interaction.replied) {
            await interaction.update({ components: [] })
        }
    }
} as IButtonHandler