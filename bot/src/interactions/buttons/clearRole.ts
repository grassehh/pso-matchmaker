
import { ActionRowBuilder, ButtonInteraction, GuildMember, StringSelectMenuBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'clearRole_',
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

        const clearRoleSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_clearRole_${selectedLineupNumber}`)
            .setPlaceholder('Select a position')

        const takenRoles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user)
        for (let role of takenRoles) {
            clearRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        await interaction.reply({ content: 'Select the position you want to clear', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(clearRoleSelectMenu)], ephemeral: true })
    }
} as IButtonHandler