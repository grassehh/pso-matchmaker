const teamService = require("../../services/teamService");
const { handle } = require("../../utils");

module.exports = {
    customId: 'leaveLineup',
    async execute(interaction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        await teamService.leaveLineup(interaction, interaction.channel, lineup)
        if (!interaction.replied) {
            await handle(interaction.update({ components: [] }))
        }
    }
}