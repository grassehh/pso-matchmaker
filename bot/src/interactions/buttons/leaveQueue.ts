import { ButtonInteraction, MessageOptions } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'leaveQueue',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
        if (lineup === null) {
            await interaction.reply({ content: `⛔ You are not in the lineup`, ephemeral: true })
            return
        }
        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ Captains are currently picking the teams', ephemeral: true })
            return
        }
        await interaction.update({ components: [] })
        const embed = interactionUtils.createInformationEmbed(`:outbox_tray: ${interaction.user} left the queue !`, interaction.user)
        let reply = await interactionUtils.createReplyForLineup(lineup) as MessageOptions
        reply.embeds = reply.embeds!.concat(embed)
        interaction.channel?.send(reply)
    }
} as IButtonHandler