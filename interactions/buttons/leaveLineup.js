const teamService = require("../../services/teamService");

module.exports = {
    customId: 'leaveLineup',
    async execute(interaction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        await teamService.leaveLineup(interaction, interaction.channel, lineup)
        if (!interaction.replied) {
            await interaction.update({ components: [] })
        }
    }
}