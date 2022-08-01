import { ButtonInteraction, GuildMember, MessageOptions } from "discord.js";
import { MAX_BENCH_SIZE } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ILineup } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    customId: 'benchRole_',
    async execute(interaction: ButtonInteraction) {
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const signedUser = lineup.roles.find(role => role.user?.id === interaction.user.id)
        if (signedUser) {
            await interaction.reply({ content: '⛔ You are already in the lineup', ephemeral: true })
            return
        }

        if (lineup.bench.length >= MAX_BENCH_SIZE) {               
            await interaction.reply({ content: '⛔ There are too many benched players, please try again later', ephemeral: true })
            return
        }

        await interaction.update({ components: [] })

        const split = interaction.customId.split('_')
        const selectedRoleName = split[1]
        const lineupNumber = parseInt(split[2])

        lineup = (await teamService.joinBench(interaction.user, lineup, [selectedRoleName], lineupNumber, interaction.member as GuildMember)) as ILineup

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup) as MessageOptions
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, `:inbox_tray: ${interaction.user} benched as **${selectedRoleName}**`)
        reply.embeds = (reply.embeds || []).concat(informationEmbed)
        await interaction.channel?.send(reply)
    }
} as IButtonHandler