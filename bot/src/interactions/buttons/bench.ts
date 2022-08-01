import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, SelectMenuBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { ROLE_NAME_ANY, teamService } from "../../services/teamService";

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
        const benchRoleSelectMenu = new SelectMenuBuilder()
            .setCustomId(`select_bench_${selectedLineupNumber}`)
            .setPlaceholder('... or select multiple positions !')
            .setMaxValues(roles.length + 1)
            .addOptions([{ label: 'Any', value: ROLE_NAME_ANY }])
        for (let role of roles) {
            benchRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        let components: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] = interactionUtils.createRolesActionRows(lineup, selectedLineupNumber, true)
        components.push(new ActionRowBuilder<SelectMenuBuilder>().addComponents(benchRoleSelectMenu))

        await interaction.reply({ content: '**Select one position you want to bench ...**', components, ephemeral: true })
    }
} as IButtonHandler