import { ButtonInteraction, TextChannel } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'refuse_challenge_',
    async execute(interaction: ButtonInteraction) {
        let challengeId = interaction.customId.substring(17);
        let challenge = await matchmakingService.findChallengeById(challengeId)
        if (!challenge) {
            await interaction.reply({ content: "⛔ This challenge no longer exists", ephemeral: true })
            return
        }

        if (challenge.initiatingUser.id === interaction.user.id) {
            await interaction.reply({ content: "⛔ You cannot refuse your own challenge request", ephemeral: true })
            return
        }

        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (!matchmakingService.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
            await interaction.reply({ content: `⛔ You must be in the lineup in order to refuse a challenge`, ephemeral: true })
            return
        }

        await matchmakingService.deleteChallengeById(challengeId)
        await matchmakingService.freeLineupQueuesByChallengeId(challengeId)

        let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId) as TextChannel
        await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
        await initiatingTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(interaction.user, `❌ **${teamService.formatTeamName(challenge.challengedTeam.lineup)}** has refused your challenge request`)] })

        await interaction.update({ components: [] })
        await interaction.channel?.send({ embeds: [interactionUtils.createInformationEmbed(interaction.user, `❌ ${interaction.user} has refused to challenge **${teamService.formatTeamName(challenge.initiatingTeam.lineup)}**'`)] })
        return
    }
} as IButtonHandler