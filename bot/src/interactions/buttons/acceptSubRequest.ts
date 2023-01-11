
import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ISub, IUser } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { statsService } from "../../services/statsService";
import { teamService } from "../../services/teamService";
import { userService } from "../../services/userService";

export default {
    customId: 'accept_sub_request_',
    async execute(interaction: ButtonInteraction) {
        const matchId = interaction.customId.split('_')[3]
        const position = interaction.customId.split('_')[4]
        const match = await matchmakingService.findMatchByMatchId(matchId)

        if (!match) {
            await interaction.reply(interactionUtils.createReplyMatchDoesntExist())
            return
        }

        const userRole = match.findUserRole(interaction.user)
        if (userRole) {
            await interaction.reply({ content: '⛔ You are already playing in this match', ephemeral: true })
            return
        }

        const user = await userService.findUserByDiscordUserId(interaction.user.id) as IUser
        await matchmakingService.addSubToMatch(matchId, { user } as ISub)

        const receivedEmbed = interaction.message.embeds[0]
        const embedBuilder = EmbedBuilder.from(receivedEmbed)
        embedBuilder.setColor("#6aa84f")
        embedBuilder.setTitle(`~~${receivedEmbed.title}~~`)
        embedBuilder.setDescription(`~~${receivedEmbed.description}~~\n${interaction.user} accepted the request`)
        await interaction.update({ components: [], embeds: [embedBuilder] })

        const playerDmEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle(`⚽ Sub Request Accepted ⚽`)
            .setDescription(`You are playing **${position}**${match.ranked ? '' : '\n\n*If you need a sub, use the **/sub_request** command*'}`)
            .addFields([
                { name: 'Match ID', value: `${match.matchId}` },
                { name: 'Lobby Name', value: `${match.lobbyName}`, inline: true },
                { name: 'Lobby Password', value: `${match.lobbyPassword}`, inline: true },
            ])
            .setTimestamp()
        await interaction.user.send({ embeds: [playerDmEmbed] })

        const channelIds = await teamService.findAllLineupChannelIdsByUserId(interaction.user.id)
        if (channelIds.length > 0) {
            await Promise.all(channelIds.map(async (channelId: string) => {
                await teamService.notifyChannelForUserLeaving(interaction.client, interaction.user, channelId, `⚠ ${interaction.user} went to sub in another match`)
            }))
        }

        statsService.updatePlayersStats(interaction.client, match.firstLineup.team.region, match.firstLineup.size, [interaction.user.id])
    }
} as IButtonHandler