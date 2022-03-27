const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");

module.exports = {
    customId: 'subRequest_select_',
    async execute(interaction) {
        const matchId = interaction.customId.split('_')[2]
        const position = interaction.values[0]

        const subRequestEmbed = new MessageEmbed()
            .setColor('#6aa84f')
            .setTitle("📣 A sub is required !")
            .setDescription(`Position: **${position}**\n*Accepting a sub request commits you to play. Doing otherwise can result in warns/bans.*`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
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

        await interaction.reply({ components: [subActionRow], embeds: [subRequestEmbed] })
    }
}