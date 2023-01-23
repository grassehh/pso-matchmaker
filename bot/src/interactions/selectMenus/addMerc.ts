import { Message, BaseMessageOptions, AnySelectMenuInteraction } from "discord.js";
import { DEFAULT_RATING, MAX_NUMBER_OF_MERCS, MERC_USER_ID } from "../../constants";
import { ISelectMenuHandler } from "../../handlers/selectMenuHandler";
import { ILineup, IUser } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { statsService } from "../../services/statsService";
import { teamService } from "../../services/teamService";
import { userService } from "../../services/userService";

export default {
    customId: 'select_addMerc_',
    async execute(interaction: AnySelectMenuInteraction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[2])
        const selectedMercRole = interaction.values[0]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.getMercSignedRoles().length >= MAX_NUMBER_OF_MERCS) {
            await interaction.reply({ content: `⛔ This cannot sign more than ${MAX_NUMBER_OF_MERCS} merc`, ephemeral: true })
            return
        }

        const selectedRole = lineup.roles.find(role => role.name === selectedMercRole && role.lineupNumber === selectedLineupNumber)!
        if (selectedRole.user) {
            await interaction.reply({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
            return
        }

        const filter = (m: Message) => interaction.user.id === m.author.id
        const collector = interaction.channel!.createMessageCollector({ filter, time: 10000, max: 1 });
        collector.on('collect', async m => {
            let lineup = await teamService.retrieveLineup(interaction.channelId)
            if (lineup === null) {
                await interaction.reply(interactionUtils.createReplyLineupNotSetup())
                return
            }

            if (selectedRole.user) {
                await interaction.followUp({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
                return
            }

            let userToAdd: IUser = {
                id: MERC_USER_ID,
                name: m.content,
                mention: m.content
            } as IUser
            let addedPlayerName
            if (m.mentions.users.size > 0) {
                const user = await userService.findUserByDiscordUserId(m.mentions.users.at(0)!.id)
                if (!user) {
                    await interaction.followUp({ content: `⛔ This user is not registered in PSO Matchmaker`, ephemeral: true })
                    return
                }
                const ban = await teamService.findPlayerBanByUserIdAndGuildId(user.id, interaction.guildId!)
                if (ban) {
                    await interaction.followUp({ content: `⛔ Player ${m.content} is banned and cannot be signed.`, ephemeral: true })
                    return
                }
                if (lineup.roles.some(role => role.user?.id === user.id)) {
                    await interaction.followUp({ content: `Player ${m.content} is already signed !`, ephemeral: true })
                    return
                }
                addedPlayerName = m.mentions.users.at(0)?.toString()
                const stats = await statsService.findPlayerStats(interaction.user.id, lineup.team.region)
                userToAdd = await userService.findUserByDiscordUserId(user.id) as IUser
                userToAdd.rating = stats ? stats.rating : DEFAULT_RATING
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
            const embed = interactionUtils.createInformationEmbed(description, interaction.user)
            if (await matchmakingService.isNotTeamAndReadyToStart(lineup)) {
                await interaction.channel?.send({ embeds: [embed] })
                const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId) || undefined
                const secondLineup = challenge ?
                    (await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId))
                    || undefined
                    : undefined
                const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction.client, lineup, secondLineup)
                if (duplicatedUsersReply) {
                    await interaction.reply(duplicatedUsersReply)
                    return
                }
                await matchmakingService.readyMatch(interaction.client, interaction, challenge, lineup)
                await interaction.reply({ content: "You have readied the match", ephemeral: true })
                return
            }

            let reply = await interactionUtils.createReplyForLineup(lineup, autoSearchResult.updatedLineupQueue) as BaseMessageOptions
            reply.embeds = (reply.embeds || []).concat(embed)
            await interaction.channel?.send(reply)
        })

        collector.on('end', async (collected: any) => {
            if (collected.size === 0) {
                await interaction.followUp({ content: "Sorry, you have taken too long to answer me ...", components: [], ephemeral: true })
                return
            }
        })

        await interaction.reply({ content: `Type the name of the player you want to sign to the **${selectedMercRole}** position`, components: [], ephemeral: true })
    }
} as ISelectMenuHandler