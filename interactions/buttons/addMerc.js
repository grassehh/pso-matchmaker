const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const { MessageActionRow, MessageSelectMenu } = require("discord.js");

module.exports = {
    customId: 'addMerc_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const lineup = await teamService.retrieveLineup(interaction.channelId)

        if (lineup.isMix() && !authorizationService.isMatchmakingAdmin(interaction.member)) {
            await interaction.reply({ content: "⛔ You are not allowed to use this action", ephemeral: true })
            return
        }

        const mercRoleSelectMenu = new MessageSelectMenu()
            .setCustomId(`select_addMerc_${selectedLineupNumber}`)
            .setPlaceholder('Select a position')

        const availableRoles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => !role.user)
        for (let role of availableRoles) {
            mercRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        await interaction.reply({ content: 'Which position do you want to sign the player on ?', components: [new MessageActionRow().addComponents(mercRoleSelectMenu)], ephemeral: true })
    }
}