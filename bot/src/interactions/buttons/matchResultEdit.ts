import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService, MatchResult } from "../../services/matchmakingService";

export default {
    customId: 'match_result_edit_',
    async execute(interaction: ButtonInteraction) {
        const matchId = interaction.customId.split('_')[3]
        const lineupNumber = parseInt(interaction.customId.split('_')[4])

        let match = await matchmakingService.findMatchByMatchId(matchId)
        if (match === null) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const matchVoteActionRow = new ActionRowBuilder<ButtonBuilder>()
        matchVoteActionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`match_result_vote_${MatchResult.WIN}_${matchId}_${lineupNumber}`)
                .setLabel("WIN !")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`match_result_vote_${MatchResult.DRAW}_${matchId}_${lineupNumber}`)
                .setLabel("DRAW")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`match_result_vote_${MatchResult.LOSS}_${matchId}_${lineupNumber}`)
                .setLabel("LOSS")
                .setStyle(ButtonStyle.Danger)
        )

        const cancelVoteActionRow = new ActionRowBuilder<ButtonBuilder>()
        cancelVoteActionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`match_result_vote_${MatchResult.CANCEL}_${matchId}_${lineupNumber}`)
                .setLabel("CANCEL")
                .setStyle(ButtonStyle.Danger)
        )

        await interaction.reply({ content: `Select a result for ${lineupNumber === 1 ? match.firstLineup.prettyPrintName() : match.secondLineup.prettyPrintName()}`, components: [matchVoteActionRow, cancelVoteActionRow], ephemeral: true })
    }
} as IButtonHandler