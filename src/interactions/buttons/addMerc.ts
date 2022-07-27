import { authorizationService, interactionUtils, teamService } from "../../beans";
import { ButtonInteraction, GuildMember, MessageActionRow, MessageSelectMenu } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'addMerc_',
    async execute(interaction: ButtonInteraction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.isMix() && !authorizationService.isMatchmakingAdmin(interaction.member as GuildMember)) {
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
} as IButtonHandler