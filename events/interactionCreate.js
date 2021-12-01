const { LineupQueue, Challenge } = require("../mongoSchema");
const { retrieveTeam, retrieveLineup, createLineupComponents, createDecideChallengeReply, createCancelChallengeReply, replyAlreadyQueued } = require("../services");
const { reserveAndGetLineupQueueById, findChallengeById, freeLineupQueueById, reserveAndGetLineupQueueByChannelId, findChallengeByGuildId, findLineupQueueByChannelId } = require("../services/matchmakingService");
const { deleteTeam, clearLineup, updateLineupQueueRole } = require("../services/teamService");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                return
            }
        }

        if (interaction.isButton()) {
            try {
                let team = await retrieveTeam(interaction.guildId)
                let lineup = await retrieveLineup(interaction.channelId, team)

                if (interaction.customId.startsWith("role_")) {
                    let roleName = interaction.customId.substring(5)
                    let playerRole = lineup.roles.find(role => role.name == roleName)

                    if (playerRole.user) {
                        await interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
                        return
                    }

                    let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                    if (existingPlayerRole != null) {
                        existingPlayerRole.user = null
                    }
                    playerRole.user = {
                        id: interaction.user.id,
                        name: interaction.user.username,
                        mention: interaction.user.toString()
                    }
                    await team.save()
                    await updateLineupQueueRole(interaction.guildId, interaction.channelId, playerRole)
                    await interaction.message.edit({ components: [] })

                    if (lineup.autoSearch === true && lineup.roles.filter(role => role.user != null).length === lineup.roles.length) {
                        let lineupQueue = await findLineupQueueByChannelId(interaction.channelId)
                        if (lineupQueue) {
                            await replyAlreadyQueued(interaction, lineupQueue.lineup.size)
                            return
                        }
                        await new LineupQueue({
                            team: team,
                            lineup: lineup
                        }).save()
                        await interaction.reply(`Player ${interaction.user} signed into the lineup as ${roleName}. Your lineup is full, it is now queued for ${lineup.size}v${lineup.size} !`)
                        return
                    }

                    await interaction.reply({ content: `Player ${interaction.user} signed into the lineup as ${roleName}`, components: createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId === 'leaveLineup') {
                    let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                    if (existingPlayerRole != null) {
                        existingPlayerRole.user = null
                    }
                    await team.save()
                    await interaction.message.edit({ components: [] })

                    if (lineup.autoSearch === true && lineup.roles.filter(role => role.user != null).length === lineup.roles.length - 1) {
                        await LineupQueue.deleteOne({ 'lineup.channelId': interaction.channelId })
                        await interaction.reply({ content: `Player ${interaction.user} left the ${existingPlayerRole.name} position. Your team is no longer in the queue !`, components: createLineupComponents(lineup, interaction.user.id) })
                        return
                    }

                    await interaction.reply({ content: `Player ${interaction.user} left the ${existingPlayerRole.name} position`, components: createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId.startsWith('challenge_')) {
                    let lineupQueueId = interaction.customId.substring(10);
                    let opponentLineupQueue = await reserveAndGetLineupQueueById(lineupQueueId)

                    if (!opponentLineupQueue) {
                        interaction.reply({ content: "❌ This team is no longer challenging", ephemeral: true })
                        return
                    }

                    let opponentChallenge = await findChallengeByGuildId(opponentLineupQueue.team.guildId)
                    if (opponentChallenge) {
                        interaction.reply({ content: "❌ This team is negociating a challenge", ephemeral: true })
                        return
                    }

                    let lineupQueue = await reserveAndGetLineupQueueByChannelId(interaction.channelId)
                    if (!lineupQueue) {
                        lineupQueue = new LineupQueue({
                            team: {
                                guildId: team.guildId,
                                name: team.name,
                                region: team.region
                            },
                            lineup: lineup
                        })
                    }
                    let challenge = new Challenge({
                        initiatingUser: {
                            id: interaction.user.id,
                            name: interaction.user.username,
                            mention: interaction.user.toString()
                        },
                        initiatingTeam: lineupQueue,
                        challengedTeam: opponentLineupQueue
                    })

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(createCancelChallengeReply(challenge))
                    let initiatingMessage = await interaction.fetchReply()
                    challenge.initiatingMessageId = initiatingMessage.id

                    let channel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    let challengedMessage = await channel.send(createDecideChallengeReply(challenge))
                    challenge.challengedMessageId = challengedMessage.id

                    await challenge.save()
                    return
                }

                if (interaction.customId.startsWith('accept_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await findChallengeById(challengeId)
                    let users = challenge.challengedTeam.lineup.roles.map(role => role.user).filter(user => user)
                    users = users.concat(challenge.initiatingTeam.lineup.roles.map(role => role.user).filter(user => user))
                    for (let toto of users) {
                        let discordUser = await interaction.client.users.fetch(toto.id)
                        discordUser.send("Match is ready !")
                    }

                    await clearLineup(team, interaction.channelId)
                    let opponentTeam = await retrieveTeam(challenge.initiatingTeam.team.guildId)
                    await clearLineup(opponentTeam, challenge.initiatingTeam.lineup.channelId)
                    await LineupQueue.deleteOne({ '_id': challenge.challengedTeam.id })
                    await LineupQueue.deleteOne({ '_id': challenge.initiatingTeam.id })
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    initiatingTeamChannel.send(`⚽ The team '${challenge.challengedTeam.team.name}' has accepted your challenge request ! The match is ready on the LOBBY !! GOGOGO`)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`⚽ You have accepted to challenge the team '${challenge.challengedTeam.team.name}' ! The match is ready on the LOBBY !! GOGOGO`)
                    return
                }

                if (interaction.customId.startsWith('refuse_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await findChallengeById(challengeId)

                    await freeLineupQueueById(challenge.challengedTeam.id)
                    await freeLineupQueueById(challenge.initiatingTeam.id)
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId)
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                    await initiatingTeamChannel.send(`The team '${challenge.challengedTeam.team.name}' has refused your challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`You have refused to challenge the team '${challenge.initiatingTeam.team.name}''`)
                    return
                }

                if (interaction.customId.startsWith('cancel_challenge_')) {
                    let challengeId = interaction.customId.substring(17);
                    let challenge = await findChallengeById(challengeId)

                    await freeLineupQueueById(challenge.challengedTeam.id)
                    await freeLineupQueueById(challenge.initiatingTeam.id)
                    await Challenge.deleteOne({ '_id': challenge.id })

                    let challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId)
                    await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
                    await challengedTeamChannel.send(`The team '${challenge.initiatingTeam.team.name}' has cancelled the challenge request`)

                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`You have cancelled your challenge request for the team '${challenge.challengedTeam.team.name}'`)
                    return
                }

                if (interaction.customId.startsWith('delete_team_yes_')) {
                    await deleteTeam(interaction.guildId);
                    await interaction.reply({ content: '✅ Your team has been deleted', ephemeral: true })
                    return
                }

                if (interaction.customId.startsWith('delete_team_no_')) {
                    await interaction.reply({ content: 'Easy peasy ! Nothing has been deleted', ephemeral: true })
                    return
                }
            } catch (error) {
                console.error(error);
                try {
                    await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
                } catch (error) {
                    //Shush
                }
            }
        }
    }
}