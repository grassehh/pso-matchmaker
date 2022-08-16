import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, SelectMenuBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { IRole } from "../../mongoSchema";
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
        let availableRolesToBench: IRole[] = []
        if (lineup.isSoloQueue()) {
            const firstLineupRoles = lineup.roles.filter(r => r.lineupNumber === 1)
            const secondLineupRoles = lineup.roles.filter(r => r.lineupNumber === 2)
            firstLineupRoles.forEach(r => {
                if (r.user && secondLineupRoles.find(sr => sr.name === r.name)?.user) {
                    availableRolesToBench.push(r)
                }
            })
        } else {
            availableRolesToBench = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user)
        }

        const benchRoleSelectMenu = new SelectMenuBuilder()
            .setCustomId(`select_bench`)
            .setPlaceholder('... or select multiple positions !')
            .setMaxValues(availableRolesToBench.length + 1)
            .addOptions([{ label: 'Any', value: `${ROLE_NAME_ANY}_${selectedLineupNumber}` }])
        for (let role of availableRolesToBench) {
            benchRoleSelectMenu.addOptions([{ label: role.name, value: `${role.name}_${role.lineupNumber}` }])
        }

        let components: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] = []
        let roles: IRole[] = []
        if (lineup.isSoloQueue()) {
            const firstLineupRoles = lineup.roles.filter(r => r.lineupNumber === 1)
            const secondLineupRoles = lineup.roles.filter(r => r.lineupNumber === 2)
            firstLineupRoles.forEach(r => {
                if (!r.user) {
                    roles.push(r)
                } else {
                    roles.push(secondLineupRoles.find(sr => sr.name === r.name)!)
                }
            })
        } else {
            roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
        }
        components = interactionUtils.createRolesActionRows(roles, true)
        components.push(new ActionRowBuilder<SelectMenuBuilder>().addComponents(benchRoleSelectMenu))

        await interaction.reply({ content: '**Select one position you want to bench ...**', components, ephemeral: true })
    }
} as IButtonHandler