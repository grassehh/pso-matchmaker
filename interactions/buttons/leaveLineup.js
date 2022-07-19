const teamService = require("../../services/teamService");
const interactionUtils = require("../../services/interactionUtils");
const { handle } = require("../../utils");

module.exports = {
    customId: 'leaveLineup',
    async execute(interaction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        await teamService.leaveLineup(interaction, interaction.channel, lineup)
        if (!interaction.replied) {
            await handle(interaction.update({ components: [] }))
        }
    }
}