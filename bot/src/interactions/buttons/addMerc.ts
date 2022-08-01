
import { ActionRowBuilder, ButtonInteraction, GuildMember, SelectMenuBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'addMerc_',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.isMix() && !authorizationService.isMatchmakingAdmin(interaction.member as GuildMember)) {
            await interaction.reply({ content: "⛔ You are not allowed to use this action", ephemeral: true })
            return
        }

        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const mercRoleSelectMenu = new SelectMenuBuilder()
            .setCustomId(`select_addMerc_${selectedLineupNumber}`)
            .setPlaceholder('Select a position')

        const availableRoles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => !role.user)
        for (let role of availableRoles) {
            mercRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        const component = new ActionRowBuilder<SelectMenuBuilder>().addComponents(mercRoleSelectMenu)

        await interaction.reply({ content: 'Which position do you want to sign the player on ?', components: [component], ephemeral: true })
    }
} as IButtonHandler