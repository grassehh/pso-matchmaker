import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";

export default {
    customId: 'cancel_sub_request_',
    async execute(interaction: ButtonInteraction) {
        const matchId = interaction.customId.split('_')[3]
        const match = await matchmakingService.findMatchByMatchId(matchId)

        if (!match) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const userRole = match.findUserRole(interaction.user)
        if (!userRole) {
            await interaction.reply({ content: '⛔ You must be in the match to cancel the sub request', ephemeral: true })
            return
        }

        const receivedEmbed = interaction.message.embeds[0]
        const embed = EmbedBuilder.from(receivedEmbed)
        embed.setColor('#ed4245')
        embed.setTitle(`~~${receivedEmbed.title}~~`)
        embed.setDescription(`~~${receivedEmbed.description}~~\n${interaction.user} cancelled the request`)
        await interaction.update({ components: [], embeds: [embed] })
    }
} as IButtonHandler