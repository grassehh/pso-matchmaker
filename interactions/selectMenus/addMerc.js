const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");
const { handle } = require("../../utils");

module.exports = {
    customId: 'select_addMerc_',
    async execute(interaction) {
        const selectedLineupNumber = parseInt(interaction.customId.split('_')[2])
        const selectedMercRole = interaction.values[0]

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
        if (roles.find(role => role.name === selectedMercRole).user?.id) {
            await interaction.reply({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
            return
        }

        const filter = m => interaction.user.id === m.author.id
        const collector = interaction.channel.createMessageCollector({ filter, time: 10000, max: 1 });
        collector.on('collect', async m => {
            let lineup = await teamService.retrieveLineup(interaction.channelId)
            if (roles.find(role => role.name === selectedMercRole).user?.id) {
                await interaction.followUp({ content: `Too late ! Someone has already signed as **${selectedMercRole}**. Please try again.`, ephemeral: true })
                return
            }

            let userToAdd
            let addedPlayerName
            if (m.mentions.users.size > 0) {
                const [user] = await handle(interaction.client.users.fetch(m.mentions.users.at(0).id))
                if (user) {
                    const ban = await teamService.findBanByUserIdAndGuildId(user.id, interaction.guildId)
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
                        name: user.username
                    }
                }
            } else {
                addedPlayerName = m.content
                userToAdd = {
                    id: "merc",
                    name: m.content
                }
            }

            lineup = await teamService.addUserToLineup(interaction.channelId, selectedMercRole, userToAdd, selectedLineupNumber)
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
                await interaction.channel.send({ embeds: [embed] })
                const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
                const secondLineup = challenge ? await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId) : null
                if (await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)) {
                    return
                }
                await matchmakingService.readyMatch(interaction, challenge, lineup)
                return
            }

            let reply = await interactionUtils.createReplyForLineup(interaction, lineup, autoSearchResult.updatedLineupQueue)
            reply.embeds = (reply.embeds || []).concat(embed)
            await interaction.channel.send(reply)
        })

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await interaction.followUp({ content: "Sorry, you have taken too long to answer me ...", components: [], ephemeral: true })
                return
            }
        })

        await interaction.reply({ content: `Type the name of the player you want to sign to the **${selectedMercRole}** position`, components: [], ephemeral: true })
    }
}