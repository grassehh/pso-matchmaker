import { ButtonInteraction, Message } from 'discord.js';
import { IButtonHandler } from '../../handlers/buttonHandler';
import { interactionUtils } from '../../services/interactionUtils';
import { matchmakingService } from '../../services/matchmakingService';
import { teamService } from '../../services/teamService';

export default {
    customId: 'accept_challenge_',
    async execute(interaction: ButtonInteraction) {
        let challengeId = interaction.customId.substring(17);
        let challenge = await matchmakingService.findChallengeById(challengeId)
        if (!challenge) {
            await interaction.reply({ content: "⛔ This challenge no longer exists", ephemeral: true })
            return
        }
        const lineup = (await teamService.retrieveLineup(interaction.channelId))!
        if (!matchmakingService.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
            await interaction.reply({ content: `⛔ You must be in the lineup in order to accept a challenge`, ephemeral: true })
            return
        }

        if (challenge.initiatingUser.id === interaction.user.id) {
            await interaction.reply({ content: "⛔ You cannot accept your own challenge request", ephemeral: true })
            return
        }

        await (interaction.message as Message).edit({ components: [] })
        await interaction.deferReply()
        const secondLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId) || undefined
        const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)
        if (duplicatedUsersReply) {
            await interaction.editReply(duplicatedUsersReply)
            return
        }
        await matchmakingService.readyMatch(interaction, challenge)
        await interaction.editReply({ embeds: [interactionUtils.createInformationEmbed(interaction.user, `${interaction.user} has accepted the challenge request`)] })
    }
} as IButtonHandler