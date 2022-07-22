import { MessageActionRow, MessageButton, MessageEmbed, SelectMenuInteraction } from "discord.js";
import { interactionUtils, matchmakingService } from "../../beans";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";

export default {
    customId: 'subRequest_select_',
    async execute(interaction: SelectMenuInteraction) {
        const matchId = interaction.customId.split('_')[2]
        const position = interaction.values[0]

        const match = await matchmakingService.findMatchByMatchId(matchId)
        if (match === null) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const subRequestEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle("📣 A sub is required !")
            .addField('Lobby', `${match.lobbyName}`, true)
            .addField('Format', `${match.firstLineup.size}v${match.firstLineup.size}`, true)
            .addField('Position', position, true)
            .setDescription('*Accepting a sub request commits you to play. Doing otherwise can result in warns/bans*')
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user.username}` })
        const subActionRow = new MessageActionRow()

        subActionRow.addComponents(
            new MessageButton()
                .setCustomId(`accept_sub_request_${matchId}_${position}`)
                .setLabel('Accept')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId(`cancel_sub_request_${matchId}`)
                .setLabel('Cancel')
                .setStyle('DANGER')
        )

        await interaction.update({ content: 'Sub request sent !', components: [] })
        await interaction.channel?.send({ components: [subActionRow], embeds: [subRequestEmbed] })
    }
} as ISelectMenuHandler