import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { MAX_NUMBER_OF_MERCS } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { teamService } from "../../services/teamService";

export default {
    customId: 'other_',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const numberOfSignedPlayers = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user != null).length
        const numberOfMissingPlayers = lineup.size - numberOfSignedPlayers
        const numberOfMercs = lineup.getMercSignedRoles().length

        const otherActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`addMerc_${selectedLineupNumber}`)
                .setLabel('Sign another player')
                .setDisabled(numberOfMissingPlayers === 0 || challenge !== null || numberOfMercs >= MAX_NUMBER_OF_MERCS)
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`clearRole_${selectedLineupNumber}`)
                .setLabel("Clear a position")
                .setDisabled(numberOfSignedPlayers === 0 || challenge !== null)
                .setStyle(ButtonStyle.Secondary)
        )
        await interaction.reply({ content: 'What do you want to do ?', components: [otherActionRow], ephemeral: true })
    }
} as IButtonHandler