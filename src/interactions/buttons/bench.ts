import { ButtonInteraction, MessageActionRow, MessageButton, MessageSelectMenu } from "discord.js";
import { ROLE_NAME_ANY } from "../../services/teamService";
import { interactionUtils, teamService } from "../../beans";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'bench_',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const selectedLineupNumber = parseInt(interaction.customId.split('_')[1])
        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user)
        const benchRoleSelectMenu = new MessageSelectMenu()
            .setCustomId(`select_bench_${selectedLineupNumber}`)
            .setPlaceholder('... or select multiple positions !')
            .setMaxValues(roles.length + 1)
            .addOptions([{ label: 'Any', value: ROLE_NAME_ANY }])
        for (let role of roles) {
            benchRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }
        const benchActionRow = new MessageActionRow().addComponents(benchRoleSelectMenu)

        let components = interactionUtils.createRolesActionRows(lineup, selectedLineupNumber, true)
        components.push(benchActionRow)

        await interaction.reply({ content: '**Select one position you want to bench ...**', components, ephemeral: true })
    }
} as IButtonHandler