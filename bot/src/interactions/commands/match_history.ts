import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { IMatch } from "../../mongoSchema";
import { matchmakingService, MatchResultType } from "../../services/matchmakingService";
import { TeamLogoDisplay } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('match_history')
        .setDescription('See recent matches'),
    async execute(interaction: ChatInputCommandInteraction) {
        const matches = await matchmakingService.findRecentMatches() as IMatch[]

        const recentMatchesEmbed = new EmbedBuilder()
            .setTitle('Recent Matches')
            .addFields(matches.map(match => {
                let name = ''
                if (match.result.firstLineup && match.result.secondLineup) {
                    name = `${match.firstLineup.prettyPrintName(TeamLogoDisplay.RIGHT)} ${MatchResultType.toEmoji(match.result.firstLineup.result)} **VS** ${MatchResultType.toEmoji(match.result.secondLineup.result)} ${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)}`
                } else {
                    name = `${match.firstLineup.prettyPrintName(TeamLogoDisplay.RIGHT)} **VS** ${match.secondLineup.prettyPrintName(TeamLogoDisplay.LEFT)}`
                }
                const value = `Match ID: ${match.matchId}\nDate: ${match.schedule.toUTCString()}`
                return { name, value }
            }))


        await interaction.reply({ embeds: [recentMatchesEmbed], ephemeral: true })
    }
} as ICommandHandler;