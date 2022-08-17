import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
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
        if (!regionService.isOfficialDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only official discords can manage matches', ephemeral: true })
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
        let result = '*None*'
        if (match.result.firstLineup && match.result.secondLineup) {
            result = `${match.firstLineup.prettyPrintName(TeamLogoDisplay.RIGHT)} ${MatchResultType.toEmoji(match.result.firstLineup.result)} **VS** ${MatchResultType.toEmoji(match.result.secondLineup.result)} ${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)}`
        }

        const fields = [
            { name: 'Match ID', value: `${match.matchId}`, inline: true },
            { name: 'Ranked', value: `${match.ranked ? '**Yes**' : 'No'}`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: 'Lobby Name', value: `${match.lobbyName}`, inline: true },
            { name: 'Lobby Password', value: `${match.lobbyPassword}`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: `${match.firstLineup.prettyPrintName()}`, value: `${firstLineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true },
            { name: `${match.secondLineup.prettyPrintName()}`, value: `${secondineupRoles.map(role => `**${role.name}:** ${role.user?.name} (${role.user?.mention})`).join('\n')}`, inline: true }
        ]
        if (match.ranked) {
            fields.push({ name: '\u200B', value: '\u200B' })
            fields.push({ name: 'Result', value: `${result}` })
        }
        const matchManageEmbed = new EmbedBuilder()
            .setTitle('Match Management')
            .addFields(fields)

        await interaction.reply({ embeds: [matchManageEmbed], ephemeral: true })
    }
} as ICommandHandler;