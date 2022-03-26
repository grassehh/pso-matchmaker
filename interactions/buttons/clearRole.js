const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const { MessageActionRow, MessageSelectMenu } = require("discord.js");

module.exports = {
    customId: 'clearRole_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        if (lineup.isMix() && !authorizationService.isMatchmakingAdmin(interaction.member)) {
            await interaction.reply({ content: "⛔ You are not allowed to use this action", ephemeral: true })
            return
        }

        const clearRoleSelectMenu = new MessageSelectMenu()
            .setCustomId(`select_clearRole_${selectedLineupNumber}`)
            .setPlaceholder('Select a position')

        const takenRoles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user)
        for (let role of takenRoles) {
            clearRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        await interaction.reply({ content: 'Select the position you want to clear', components: [new MessageActionRow().addComponents(clearRoleSelectMenu)], ephemeral: true })
    }
}