import { ButtonInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'mix_lineup_',
    async execute(interaction: ButtonInteraction) {
        const split = interaction.customId.split('_')
        const selectedLineup = parseInt(split[2])
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }
        const components = interactionUtils.createLineupComponents(lineup, undefined, undefined, selectedLineup)
        await interaction.reply({ content: `What do you want to do in the **${selectedLineup === 1 ? 'Red' : 'Blue'} Team** ?`, components, ephemeral: true })
    }
} as IButtonHandler