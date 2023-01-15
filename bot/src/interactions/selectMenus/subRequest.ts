import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AnySelectMenuInteraction } from "discord.js";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";

export default {
    customId: 'subRequest_select_',
    async execute(interaction: AnySelectMenuInteraction) {
        const matchId = interaction.customId.split('_')[2]
        const position = interaction.values[0]

        const match = await matchmakingService.findMatchByMatchId(matchId)
        if (match === null) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const subRequestEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle("📣 A sub is required !")
            .addFields([
                { name: 'Requester', value: `${interaction.user}` },
                { name: 'Lobby', value: `${match.lobbyName}`, inline: true },
                { name: 'Format', value: `${match.firstLineup.size}v${match.firstLineup.size}`, inline: true },
                { name: 'Position', value: position, inline: true }
            ])
            .setDescription('*Accepting a sub request commits you to play. Doing otherwise can result in warns/bans*')
            .setTimestamp()
            .setFooter({ text: `Match ID: ${matchId}` })
        const subActionRow = new ActionRowBuilder<ButtonBuilder>()

        subActionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`accept_sub_request_${matchId}_${position}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cancel_sub_request_${matchId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        )

        await interaction.update({ content: 'Sub request sent !', components: [] })
        await interaction.channel?.send({ components: [subActionRow], embeds: [subRequestEmbed] })
    }
} as ISelectMenuHandler