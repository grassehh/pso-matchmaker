const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'mix_lineup_',
    async execute(interaction) {
        const split = interaction.customId.split('_')
        const selectedLineup = parseInt(split[2])
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        const components = interactionUtils.createLineupComponents(lineup, null, null, selectedLineup)
        await interaction.reply({ content: `What do you want to do in the **${selectedLineup === 1 ? 'Red' : 'Blue'} Team** ?`, components, ephemeral: true })
    }
}