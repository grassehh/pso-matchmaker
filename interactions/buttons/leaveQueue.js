const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'leaveQueue',
    async execute(interaction) {
        const lineup = await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id)
        if (!lineup) {
            await interaction.reply({ content: `⛔ You are not in the lineup`, ephemeral: true })
            return
        }
        if (lineup.isPicking) {
            await interaction.reply({ content: '⛔ Captains are currently picking the teams', ephemeral: true })
            return
        }
        await interaction.update({ components: [] })
        const embed = interactionUtils.createInformationEmbed(interaction.user, `:outbox_tray: ${interaction.user} left the queue !`)
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
        reply.embeds = reply.embeds.concat(embed)
        interaction.channel.send(reply)
    }
}