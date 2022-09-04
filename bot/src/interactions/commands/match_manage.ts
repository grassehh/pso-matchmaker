import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { matchmakingService, MatchResultType } from "../../services/matchmakingService";
import { regionService } from "../../services/regionService";
import { TeamLogoDisplay } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('match_manage')
        .setDescription('See information about a match and manage it')
        .addStringOption(option => option.setName('match_id')
            .setRequired(true)
            .setDescription('The id of the match to manage')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isRegionalDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only regional discords can manage matches', ephemeral: true })
            return
        }
        const matchId = interaction.options.getString('match_id')!
        const match = await matchmakingService.findMatchByMatchId(matchId)

        if (!match) {
            await interaction.reply({ content: '⛔ This match does not exist', ephemeral: true })
            return
        }

        const firstLineupRoles = match.firstLineup.roles.filter(role => role.user)
        const secondineupRoles = match.secondLineup.roles.filter(role => role.user)

        const fields = [
            { name: 'Match ID', value: `${match.matchId}`, inline: true },
            { name: 'Date', value: `${match.schedule.toUTCString()}`, inline: true },
            { name: 'Ranked', value: `${match.ranked ? '**Yes**' : 'No'}`, inline: true },
            { name: 'Lobby Name', value: `${match.lobbyName}`, inline: true },
            { name: 'Lobby Password', value: `${match.lobbyPassword}`, inline: true },
            { name: '\u200B', value: '\u200B' },
        ]

        if (match.ranked) {
            const firstLineupResult = match.result!.firstLineup.result !== undefined ? MatchResultType.toString(match.result!.firstLineup.result) : '*Not voted*'
            const firstLineupCaptain = match.firstLineup.roles.find(role => role.user!.id === match.result!.firstLineup.captainUserId)!
            fields.push({ name: `${match.firstLineup.prettyPrintName()} Line-up`, value: `${secondineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true })
            fields.push({ name: `${match.firstLineup.prettyPrintName(TeamLogoDisplay.LEFT)} Captain`, value: `${firstLineupCaptain.user?.name} (${firstLineupCaptain.user?.mention})`, inline: true })
            fields.push({ name: `${match.firstLineup.prettyPrintName(TeamLogoDisplay.LEFT)} Result`, value: `${firstLineupResult}`, inline: true })

            const secondLineupResult = match.result!.secondLineup.result !== undefined ? MatchResultType.toString(match.result!.secondLineup.result) : '*Not voted*'
            const secondLineupCaptain = match.secondLineup.roles.find(role => role.user!.id === match.result!.secondLineup.captainUserId)!
            fields.push({ name: `${match.secondLineup.prettyPrintName()} Line-up`, value: `${firstLineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true })
            fields.push({ name: `${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)} Captain`, value: `${secondLineupCaptain.user?.name} (${secondLineupCaptain.user?.mention})`, inline: true })
            fields.push({ name: `${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)} Result`, value: `${secondLineupResult}`, inline: true })
        } else {
            fields.push({ name: `${match.firstLineup.prettyPrintName()}`, value: `${firstLineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true })
            fields.push({ name: `${match.secondLineup.prettyPrintName()}`, value: `${secondineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true })
        }

        const matchManageEmbed = new EmbedBuilder()
            .setTitle('Match Management')
            .addFields(fields)

        const matchResultActionRow = new ActionRowBuilder<ButtonBuilder>()
        if (match.ranked) {
            if (match.result!.firstLineup.result == null) {
                matchResultActionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_result_edit_${matchId}_1`)
                        .setLabel(`Edit ${match.firstLineup.prettyPrintName()} result`)
                        .setStyle(ButtonStyle.Primary)
                )
            }

            if (match.result!.secondLineup.result == null) {
                matchResultActionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_result_edit_${matchId}_2`)
                        .setLabel(`Edit ${match.secondLineup.prettyPrintName()} result`)
                        .setStyle(ButtonStyle.Primary)
                )
            }
        }
        await interaction.reply({ embeds: [matchManageEmbed], components: matchResultActionRow.components.length === 0 ? [] : [matchResultActionRow], ephemeral: true })
    }
} as ICommandHandler;