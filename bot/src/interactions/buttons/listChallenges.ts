import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { MERC_USER_ID } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'listChallenges',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const lineupHasAnyMerc = lineup.roles.some(role => role.user?.id === MERC_USER_ID)

        const searchActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('challenges_ranked')
                    .setLabel('Ranked')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!lineup.allowRanked || lineupHasAnyMerc),
                new ButtonBuilder()
                    .setCustomId('challenges_casual')
                    .setLabel('Casual')
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({ content: 'Select a mode', components: [searchActionRow], ephemeral: true })
    }
} as IButtonHandler