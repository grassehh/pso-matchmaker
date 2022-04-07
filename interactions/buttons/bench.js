const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const { MessageActionRow, MessageSelectMenu } = require("discord.js");

module.exports = {
    customId: 'bench_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        const clearRoleSelectMenu = new MessageSelectMenu()
            .setCustomId(`select_bench_${selectedLineupNumber}`)
            .setPlaceholder('Select a position to bench')
            .addOptions({ label: 'Any', value: 'any' })

        const takenRoles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user)
        for (let role of takenRoles) {
            clearRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        await interaction.reply({ content: 'Select the position you want to bench', components: [new MessageActionRow().addComponents(clearRoleSelectMenu)], ephemeral: true })
    }
}