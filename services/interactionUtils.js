const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require("discord.js");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const matchmakingService = require("../services/matchmakingService");
const { Stats } = require("../mongoSchema");
const { handle } = require("../utils");

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `❌ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command`,
        ephemeral: true
    })
}

exports.replyNotQueued = async (interaction) => {
    await interaction.reply({
        content: `❌ Your team is not queued for matchmaking`,
        ephemeral: true
    })
}

exports.replyTeamNotRegistered = async (interaction) => {
    await interaction.reply({
        content: '❌ Please register your team with the /register_team command first',
        ephemeral: true
    })
}

exports.replyAlreadyChallenging = async (interaction, challenge) => {
    await interaction.reply({
        content: `❌ Your team is negotiating a challenge between the teams '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' and '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`,
        ephemeral: true
    })
}

exports.replyLineupNotSetup = async (interaction) => {
    await interaction.reply({
        content: '❌ This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
        ephemeral: true
    })
}

exports.createCancelChallengeReply = (interaction, challenge) => {
    let cancelChallengeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`cancel_challenge_${challenge.id}`)
                .setLabel(`Cancel Request`)
                .setStyle('DANGER')
        )
    return { content: `💬 ${interaction.user} has sent a challenge request to the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'. You can either wait for their answer, or cancel your request.`, components: [cancelChallengeRow] }
}

exports.createDecideChallengeReply = (interaction, challenge) => {
    const challengeEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Team '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' is challenging you for a ${challenge.initiatingTeam.lineup.size}v${challenge.initiatingTeam.lineup.size} match !`)
        .setDescription(`Contact ${challenge.initiatingUser.mention} if you want to arrange further.`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)
    let challengeActionRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`accept_challenge_${challenge.id}`)
                .setLabel(`Accept`)
                .setStyle('SUCCESS'),
            new MessageButton()
                .setCustomId(`refuse_challenge_${challenge.id}`)
                .setLabel(`Refuse`)
                .setStyle('DANGER')
        )
    return { embeds: [challengeEmbed], components: [challengeActionRow] }
}

exports.createLineupComponents = (lineup, lineupQueue) => {

    let components = []

    const gkActionRow = new MessageActionRow()
    const midfieldersActionRow = new MessageActionRow()
    const attackersActionRow = new MessageActionRow()
    const defendersActionRow = new MessageActionRow()

    for (role of lineup.roles) {
        let actionRow
        switch (role.type) {
            case teamService.ROLE_GOAL_KEEPER: {
                actionRow = gkActionRow
                break
            }
            case teamService.ROLE_ATTACKER: {
                actionRow = attackersActionRow
                break
            }
            case teamService.ROLE_MIDFIELDER: {
                actionRow = midfieldersActionRow
                break
            }
            case teamService.ROLE_DEFENDER: {
                actionRow = defendersActionRow
                break
            }
        }

        let playerName = role.user ? role.user.name.substring(0, 60) : null
        actionRow.addComponents(
            new MessageButton()
                .setCustomId(`role_${role.name}`)
                .setLabel(role.user == null ? role.name : `${role.name}: ${playerName}`)
                .setStyle('PRIMARY')
                .setDisabled(role.user != null)
        )
    }

    if (attackersActionRow.components.length > 0) {
        components.push(attackersActionRow)
    }
    if (midfieldersActionRow.components.length > 0) {
        components.push(midfieldersActionRow)
    }
    if (defendersActionRow.components.length > 0) {
        components.push(defendersActionRow)
    }
    if (gkActionRow.components.length > 0) {
        components.push(gkActionRow)
    }

    const lineupActionsRow = new MessageActionRow()
    if (lineupQueue) {
        lineupActionsRow.addComponents(
            new MessageButton()
                .setCustomId(`stopSearch`)
                .setLabel(`Stop search`)
                .setStyle('DANGER')
        )
    } else {
        lineupActionsRow.addComponents(
            new MessageButton()
                .setCustomId(`startSearch`)
                .setLabel('Search')
                .setDisabled(!matchmakingService.isLineupAllowedToJoinQueue(lineup))
                .setStyle('SUCCESS')
        )
    }

    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaveLineup`)
            .setLabel(`Leave`)
            .setStyle('DANGER')
    )

    const numberOfSignedPlayers = lineup.roles.filter(role => role.user != null).length
    const numberOfMissingPlayers = lineup.size - numberOfSignedPlayers
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`clearRole`)
            .setLabel("Clear a position")
            .setDisabled(numberOfSignedPlayers === 0)
            .setStyle('SECONDARY')
    )
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`addMerc`)
            .setLabel('Sign another player')
            .setDisabled(numberOfMissingPlayers === 0)
            .setStyle('SECONDARY')
    )
    components.push(lineupActionsRow)

    return components
}

exports.replyNotAllowed = async (interaction) => {
    await interaction.reply({ content: '❌ You are not allowed to execute this command', ephemeral: true })
}

exports.createStatsEmbeds = async (interaction, userId, guildId) => {
    let user = await interaction.client.users.resolve(userId)
    let stats = await statsService.findStats(userId, guildId)
    if (stats.length === 0) {
        stats = new Stats({
            numberOfGames: 0
        })
    } else {
        stats = stats[0]
    }
    const statsEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`${guildId ? 'Team' : 'Global'} stats`)
        .setTimestamp()
        .setDescription(user.toString())
        .setFooter(`Author: ${interaction.user.username}`)
    statsEmbed.addField('⚽ Games played', stats.numberOfGames.toString())

    return [statsEmbed]
}

exports.createLeaderBoardEmbeds = async (interaction, numberOfPages, searchOptions = {}) => {
    const { guildId, page = 0, pageSize = statsService.DEFAULT_LEADERBOARD_PAGE_SIZE, lineupSizes = [] } = searchOptions
    let allStats = await statsService.findStats(null, guildId, page, pageSize, lineupSizes)
    let statsEmbed
    if (allStats.length === 0) {
        statsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`${guildId ? 'Team' : 'Global'} ⚽ GAMES Leaderboard 🏆`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
            .addField('Ooooof', 'This looks pretty empty here. Time to get some games lads !')
    } else {
        statsEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`${guildId ? 'Team' : 'Global'} ⚽ GAMES Leaderboard 🏆`)
            .setTimestamp()
            .setFooter(`Author: ${interaction.user.username}`)
        let playersStats = ''
        let pos = (pageSize * page) + 1
        for (let stats of allStats) {
            let user = await interaction.client.users.fetch(stats._id)
            if (user) {
                let isLeader = pos === 1 && page === 0
                let isTop3 = pos <= 3
                playersStats += `${isTop3 ? '**' : ''}${pos}. ${isLeader ? '🏆 ' : ''} ${user.username} (${stats.numberOfGames})${isLeader ? ' 🏆' : ''}${isTop3 ? '**' : ''}\n`
                pos++
            }
        }

        statsEmbed.addField(`Page ${page + 1}/${numberOfPages}`, playersStats)
    }

    if (lineupSizes.length > 0) {
        let description = "Selected sizes: "
        for (let lineupSize of lineupSizes) {
            description += `${lineupSize}v${lineupSize}, `
        }
        description = description.substring(0, description.length - 2)
        statsEmbed.setDescription(description)
    }

    return [statsEmbed]
}

exports.createLeaderBoardPaginationComponent = (searchOptions = {}, numberOfPages) => {
    const { globalStats, page, lineupSizes } = searchOptions
    const paginationActionsRow = new MessageActionRow()
    paginationActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaderboard_first_page_${globalStats}_${lineupSizes}`)
            .setLabel('<<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${lineupSizes}_${page - 1}`)
            .setLabel('<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${lineupSizes}_${page + 1}`)
            .setLabel('>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1),
        new MessageButton()
            .setCustomId(`leaderboard_last_page_${globalStats}_${lineupSizes}`)
            .setLabel('>>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1)
    )

    return paginationActionsRow
}

exports.createLineupEmbedForNextMatch = async (interaction, lineup, opponentLineup, lobbyName, lobbyPassword) => {
    let lineupEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Match lineup against the Team '${teamService.formatTeamName(opponentLineup)}'`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)

    let promises = lineup.roles.map(async (role) => {
        if (!role.user) {
            return { role, playerName: '*empty*' }
        }

        let playerName = `**${role.user.name}**`
        let [discordUser] = await handle(interaction.client.users.fetch(role.user.id))
        if (discordUser) {
            let channelIds = await teamService.findAllLineupChannelIdsByUserId(role.user.id)
            if (channelIds.length > 0) {
                await matchmakingService.removeUserFromAllLineupQueues(role.user.id)
                await teamService.removeUserFromLineupsByChannelIds(role.user.id, channelIds)
                await Promise.all(channelIds.map(async channelId => {
                    await teamService.notifyChannelForUserLeaving(interaction.client, channelId, `⚠ Player ${discordUser} has gone to play another match.`)
                }))
            }
            let playerDmEmbed = new MessageEmbed()
                .setColor('#6aa84f')
                .setTitle(`⚽ PSO Match ready ⚽`)
                .setDescription(`Your are playing **${role.name}** against the team **${teamService.formatTeamName(opponentLineup)}**`)
                .addField('Lobby name', `**${lobbyName}**`, true)
                .addField('Lobby password', `**${lobbyPassword}**`, true)
                .setTimestamp()
            await handle(discordUser.send({ embeds: [playerDmEmbed] }))
            playerName = discordUser
        }

        return { role, playerName }
    })

    const rolesWithPlayer = await Promise.all(promises)

    let i = 1
    for (let roleWithPlayer of rolesWithPlayer) {
        lineupEmbed.addField(roleWithPlayer.role.name, roleWithPlayer.playerName.toString(), i % 4 !== 0)
        i++
    }

    return lineupEmbed
}

exports.createLeaderBoardLineupSizeComponent = (globalStats) => {
    return new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId(`leaderboard_lineup_size_select_${globalStats}`)
            .setPlaceholder('Lineup Size')
            .setMinValues(0)
            .setMaxValues(11)
            .addOptions([
                {
                    label: '1v1',
                    value: '1'
                },
                {
                    label: '2v2',
                    value: '2'
                },
                {
                    label: '3v3',
                    value: '3'
                },
                {
                    label: '4v4',
                    value: '4'
                },
                {
                    label: '5v5',
                    value: '5'
                },
                {
                    label: '6v6',
                    value: '6'
                },
                {
                    label: '7v7',
                    value: '7'
                },
                {
                    label: '8v8',
                    value: '8'
                },
                {
                    label: '9v9',
                    value: '9'
                },
                {
                    label: '10v10',
                    value: '10'
                },
                {
                    label: '11v11',
                    value: '11'
                }
            ])
    )
}