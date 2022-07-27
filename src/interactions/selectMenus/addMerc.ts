import { Message, MessageOptions, SelectMenuInteraction } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { MERC_USER_ID } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { ILineup } from "../../mongoSchema";
import { handle } from "../../utils";

export default {
    customId: 'select_addMerc_',
    async execute(interaction: SelectMenuInteraction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[2])
        const selectedMercRole = interaction.values[0]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
        if (roles.find(role => role.name === selectedMercRole)!.user?.id) {
            await interaction.reply({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
            return
        }

        const filter = (m: Message) => interaction.user.id === m.author.id
        const collector = interaction.channel!.createMessageCollector({ filter, time: 10000, max: 1 });
        collector.on('collect', async (m: Message) => {
            let lineup = await teamService.retrieveLineup(interaction.channelId)
            if (lineup === null) {
                await interaction.reply(interactionUtils.createReplyLineupNotSetup())
                return
            }

            if (roles.find(role => role.name === selectedMercRole)!.user?.id) {
                await interaction.followUp({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
                return
            }

            let userToAdd = {
                id: MERC_USER_ID,
                name: m.content,
                mention: m.content
            }
            let addedPlayerName
            if (m.mentions.users.size > 0) {
                const [user] = await handle(interaction.client.users.fetch(m.mentions.users.at(0)!.id))
                if (user) {
                    const ban = await teamService.findBanByUserIdAndGuildId(user.id, interaction.guildId!)
                    if (ban) {
                        await interaction.followUp({ content: `⛔ Player ${m.content} is banned and cannot be signed.`, ephemeral: true })
                        return
                    }
                    if (user.bot) {
                        await interaction.followUp({ content: 'Nice try 😉', ephemeral: true })
                        return
                    }
                    if (lineup.roles.some(role => role.user?.id === user.id)) {
                        await interaction.followUp({ content: `Player ${m.content} is already signed !`, ephemeral: true })
                        return
                    }
                    addedPlayerName = user.toString()
                    userToAdd = {
                        id: user.id,
                        name: user.username,
                        mention: user.toString()
                    }
                }
            } else {
                addedPlayerName = m.content
            }

            lineup = await teamService.addUserToLineup(interaction.channelId, selectedMercRole, userToAdd, selectedLineupNumber) as ILineup
            await matchmakingService.addUserToLineupQueue(interaction.channelId, selectedMercRole, userToAdd, selectedLineupNumber)

            let description = `:inbox_tray: ${interaction.user} manually signed **${addedPlayerName}** as **${selectedMercRole}**`
            const autoSearchResult = await matchmakingService.checkIfAutoSearch(interaction.client, interaction.user, lineup)
            if (autoSearchResult.joinedQueue) {
                description += `\nYour lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
            }
            if (autoSearchResult.leftQueue) {
                description += `\nYou are no longer searching for a team.`
            }
            if (autoSearchResult.cancelledChallenge) {
                description += `\nThe challenge request has been cancelled.`
            }
            const embed = interactionUtils.createInformationEmbed(interaction.user, description)
            if (await matchmakingService.isMixOrCaptainsReadyToStart(lineup)) {
                await interaction.channel?.send({ embeds: [embed] })
                const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId) || undefined
                const secondLineup = challenge ?
                    (await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId))
                    || undefined
                    : undefined
                const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)
                if (duplicatedUsersReply) {
                    await interaction.reply(duplicatedUsersReply)
                    return
                }
                await matchmakingService.readyMatch(interaction, challenge, lineup)
                await interaction.reply({ content: "You have readied the match", ephemeral: true })
                return
            }

            let reply = await interactionUtils.createReplyForLineup(interaction, lineup, autoSearchResult.updatedLineupQueue) as MessageOptions
            reply.embeds = (reply.embeds || []).concat(embed)
            await interaction.channel?.send(reply)
        })

        collector.on('end', async (collected: any) => {
            if (collected.size === 0) {
                await interaction.followUp({ content: "Sorry, you have taken too long to answer me ...", components: [], ephemeral: true })
                return
            }
        })

        await interaction.update({ components: [] })
        await interaction.followUp({ content: `Type the name of the player you want to sign to the **${selectedMercRole}** position`, components: [], ephemeral: true })
    }
} as ISelectMenuHandler