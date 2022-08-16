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

        const roleSelected = interaction.customId.substring(interaction.customId.indexOf('_') + 1)
        lineup = (await teamService.joinBench(interaction.user, lineup, [roleSelected], interaction.member as GuildMember)) as ILineup

        let reply = await interactionUtils.createReplyForLineup(lineup) as MessageOptions
        let informationEmbed
        if (lineup.isAnonymous()) {
            informationEmbed = interactionUtils.createInformationEmbed(':inbox_tray: A player joined the bench')
        } else {
            informationEmbed = interactionUtils.createInformationEmbed(`:inbox_tray: ${interaction.user} benched as **${roleSelected.split('_')[0]}**`, interaction.user)
        }
        reply.embeds = (reply.embeds || []).concat(informationEmbed)
        await interaction.channel?.send(reply)
    }
} as IButtonHandler