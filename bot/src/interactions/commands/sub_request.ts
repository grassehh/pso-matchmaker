import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ChatInputCommandInteraction, StringSelectMenuBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";

export default {
    data: new SlashCommandBuilder()
        .setName('sub_request')
        .setDescription(`Send a sub request for a given match`)
        .addStringOption(option => option.setName('match_id')
            .setRequired(true)
            .setDescription('The id of the match you want to request a sub for')),
    async execute(interaction: ChatInputCommandInteraction) {
        const matchId = interaction.options.getString('match_id')!

        const match = await matchmakingService.findMatchByMatchId(matchId)
        if (!match) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        if (match.ranked) {
            await interaction.reply({ content: '⛔ Requesting subs for ranked matches is not allowed', ephemeral: true })
            return
        }

        if (!match.findUserRole(interaction.user)) {
            await interaction.reply({ content: '⛔ You must be playing this match in order to request a sub', ephemeral: true })
            return
        }

        const subSelectActionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        const subRoleSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`subRequest_select_${match.matchId}`)
            .setPlaceholder('Which position do you need a sub for ?')

        const roles = match.firstLineup.roles.filter(role => role.lineupNumber === 1)
        for (let role of roles) {
            subRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        subSelectActionRow.addComponents(subRoleSelectMenu)

        await interaction.reply({ components: [subSelectActionRow], ephemeral: true })
    }
} as ICommandHandler;