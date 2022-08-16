import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { IRole } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'solo_join',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const firstLineupRoles = lineup.roles.filter(r => r.lineupNumber === 1)
        const secondLineupRoles = lineup.roles.filter(r => r.lineupNumber === 2)
        const roles: IRole[] = []
        firstLineupRoles.forEach(r => {
            if (!r.user) {
                roles.push(r)
            } else {
                roles.push(secondLineupRoles.find(sr => sr.name === r.name)!)
            }
        })

        const actionRows = interactionUtils.createRolesActionRows(roles)
        const lineupActionsRow = new ActionRowBuilder<ButtonBuilder>()
        const numberOfSignedPlayers = roles.filter(role => role.user).length
        lineupActionsRow.addComponents(
            new ButtonBuilder()
                .setCustomId('bench_')
                .setLabel('Sign Bench')
                .setDisabled(numberOfSignedPlayers === 0)
                .setStyle(ButtonStyle.Primary)
        )

        actionRows.push(lineupActionsRow)

        await interaction.reply({ content: `What do you want to do ?`, components: actionRows, ephemeral: true })
    }
} as IButtonHandler