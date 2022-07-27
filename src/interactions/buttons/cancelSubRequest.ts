import { ButtonInteraction, MessageEmbed } from "discord.js";
import { matchmakingService, interactionUtils } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

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

        const embed = interaction.message.embeds[0] as MessageEmbed
        embed.setColor('#ed4245')
        embed.title = `~~${embed.title}~~`
        embed.description = `~~${embed.description}~~\n${interaction.user} cancelled the request`
        await interaction.update({ components: [], embeds: [embed] })
    }
} as IButtonHandler