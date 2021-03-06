
import { matchmakingService, teamService, statsService, interactionUtils } from "../../beans";
import { ButtonInteraction, MessageEmbed } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";

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

        await matchmakingService.addSubToMatch(matchId, {
            user: {
                id: interaction.user.id,
                name: interaction.user.username,
                mention: interaction.user.toString()
            }
        })

        const embed = interaction.message.embeds[0] as MessageEmbed
        embed.setColor("#6aa84f")
        embed.title = `~~${embed.title}~~`
        embed.description = `~~${embed.description}~~\n${interaction.user} accepted the request`
        await interaction.update({ components: [], embeds: [embed] })

        const playerDmEmbed = new MessageEmbed()
            .setColor('#6aa84f')
            .setTitle(`⚽ Sub Request Accepted ⚽`)
            .setDescription(`You are playing **${position}**\n\n*If you need a sub, please type **/request_sub** followed by the match id **${matchId}***`)
            .addField('Lobby Name', `${match.lobbyName}`, true)
            .addField('Lobby Password', `${match.lobbyPassword}`, true)
            .setTimestamp()
        await interaction.user.send({ embeds: [playerDmEmbed] })

        const channelIds = await teamService.findAllLineupChannelIdsByUserId(interaction.user.id)
        if (channelIds.length > 0) {
            await matchmakingService.removeUserFromAllLineupQueues(interaction.user.id)
            await teamService.removeUserFromLineupsByChannelIds(interaction.user.id, channelIds)
            await Promise.all(channelIds.map(async (channelId: string) => {
                await teamService.notifyChannelForUserLeaving(interaction.client, interaction.user, channelId, `⚠ ${interaction.user} went to sub in another match`)
            }))
        }

        statsService.updateStats(interaction, match.firstLineup.team.region, match.firstLineup.size, [interaction.user.id])
    }
} as IButtonHandler