const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require("discord.js");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const matchmakingService = require("../services/matchmakingService");
const { Stats } = require("../mongoSchema");
const { handle } = require("../utils");

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `⛔ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command`,
        ephemeral: true
    })
}

exports.replyNotQueued = async (interaction) => {
    await interaction.reply({
        content: `⛔ Your team is not queued for matchmaking`,
        ephemeral: true
    })
}

exports.replyTeamNotRegistered = async (interaction) => {
    await interaction.reply({
        content: '⛔ Please register your team with the /register_team command first',
        ephemeral: true
    })
}

exports.replyMatchDoesntExist = async (interaction) => {
    await interaction.reply({
        content: '⛔ This match does not exist',
        ephemeral: true
    })
}

exports.replyAlreadyChallenging = async (interaction, challenge) => {
    await interaction.reply({
        content: `⛔ Your team is negotiating a challenge between the teams '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' and '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`,
        ephemeral: true
    })
}

exports.replyLineupNotSetup = async (interaction) => {
    await interaction.reply({
        content: '⛔ This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
        ephemeral: true
    })
}

exports.createCancelChallengeReply = (interaction, challenge) => {
    let embed = new MessageEmbed()
        .setColor('#566573')
        .setFooter({ text: `Author: ${interaction.user.username}` })
        .setTimestamp()

    if (challenge.challengedTeam.lineup.isMix()) {
        embed.setDescription(`💬 ${interaction.user} is challenging the mix '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'.\nThe match will start automatically once the mix lineup is full.`)
    } else {
        embed.setDescription(`💬 ${interaction.user} has sent a challenge request to the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'.\nYou can either wait for their answer, or cancel your request.`)
    }

    let cancelChallengeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`cancel_challenge_${challenge.id}`)
                .setLabel(`Cancel Challenge`)
                .setStyle('DANGER')
        )

    return { embeds: [embed], components: [cancelChallengeRow] }
}

exports.createDecideChallengeReply = (interaction, challenge) => {

    if (challenge.challengedTeam.lineup.isMix()) {
        reply = createReplyForMixLineup(challenge.challengedTeam.lineup, challenge.initiatingTeam.lineup)
        reply.embeds = reply.embeds.concat(this.createInformationEmbed(interaction.user, `**${teamService.formatTeamName(challenge.initiatingTeam.lineup)}** is challenging the mix`))
        return reply
    } else {
        let description = `**${teamService.formatTeamName(challenge.initiatingTeam.lineup)}**`
        const challengeEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle(`A team wants to play against you !`)
            .setTimestamp()
            .setFooter({ text: `Author: ${interaction.user.username}` })
        description += `\n${challenge.initiatingTeam.lineup.roles.filter(role => role.user != null).length} players signed`
        if (!teamService.hasGkSigned(challenge.initiatingTeam.lineup)) {
            description += ' **(no GK)**'
        }
        description += `\n\n*Contact ${challenge.initiatingUser.mention} for more information*`
        challengeEmbed.setDescription(description)
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
}

exports.createReplyForLineup = async (interaction, lineup, lineupQueue) => {
    if (lineup.isMix() || lineup.isPicking) {
        const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        let challengingLineup
        if (challenge) {
            challengingLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
        }
        return createReplyForMixLineup(lineup, challengingLineup)
    }

    if (lineup.isCaptains()) {
        return createReplyForCaptainsLineup(lineup)
    }

    return createReplyForTeamLineup(lineup, lineupQueue)
}

exports.createCaptainsPickComponent = (roles) => {
    const captainActionsComponents = []
    const filteredRoles = roles.filter(role => role.user)
    let i = 0
    for (let role of filteredRoles) {
        if (i % 5 === 0) {
            captainActionsComponents.push(new MessageActionRow())
        }

        let playerName = role.user.name.substring(0, 60)
        if (role.name.includes('GK')) {
            playerName += ' (GK)'
        }
        captainActionsComponents[captainActionsComponents.length - 1].addComponents(
            new MessageButton()
                .setCustomId(`pick_${role.user.id}_${i}`)
                .setLabel(playerName)
                .setStyle('PRIMARY')
        )
        i++
    }

    return captainActionsComponents
}

exports.replyNotAllowed = async (interaction) => {
    await interaction.reply({ content: '⛔ You are not allowed to execute this command', ephemeral: true })
}

exports.createStatsEmbeds = async (interaction, userId, region) => {
    const user = await interaction.client.users.resolve(userId)
    let stats = await statsService.findStats(userId, region)
    if (stats.length === 0) {
        stats = new Stats({
            numberOfGames: 0,
            numberOfRankedGames: 0
        })
    } else {
        stats = stats[0]
    }

    const statsEmbed = new MessageEmbed()
        .setColor('#566573')
        .setTitle(`${region ? '⛺ Region' : '🌎 Global'} Stats`)
        .setDescription(`Ranked Games are matches played with a format of 5v5 or more\n${user.toString()}`)
    statsEmbed.addField('🏆 Ranked Games Played', stats.numberOfRankedGames.toString())
    statsEmbed.addField('⚽ Total Games Played', stats.numberOfGames.toString())

    return [statsEmbed]
}

exports.createLeaderBoardEmbeds = async (interaction, numberOfPages, searchOptions = {}) => {
    const { region, page = 0, pageSize = statsService.DEFAULT_LEADERBOARD_PAGE_SIZE } = searchOptions
    let allStats = await statsService.findStats(null, region, page, pageSize)
    let statsEmbed
    if (allStats.length === 0) {
        statsEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle('🏆 Games Leaderboard 🏆')
            .addField('Ooooof', 'This looks pretty empty here. Time to get some games lads !')
    } else {
        statsEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle('🏆 Games Leaderboard 🏆')
        let playersStats = ''
        let pos = (pageSize * page) + 1
        for (let stats of allStats) {
            let [user] = await handle(interaction.client.users.fetch(stats._id))
            const username = user ? user.username : '*deleted user*'
            let emoji = ''
            if (pos === 1) {
                emoji = '🥇'
            } else if (pos === 2) {
                emoji = '🥈'
            } else if (pos === 3) {
                emoji = '🥉'
            }
            let isTop3 = pos <= 3
            playersStats += `${isTop3 ? '**' : ''}${pos}. ${emoji} ${username} - ${stats.numberOfRankedGames} *(${stats.numberOfGames})* ${emoji}${isTop3 ? '**' : ''}\n`
            pos++
        }

        statsEmbed.addField(`Page ${page + 1}/${numberOfPages}`, playersStats)
    }

    statsEmbed.setDescription(
        `Stats are displayed in the following way: 'Player - RankedGames *(TotalGames)*'
        Ranked Games are matches played with a format of 5v5 or more.

        **${region ? '⛺ Region' : '🌎 Global'} Stats**`
    )

    return [statsEmbed]
}

exports.createLeaderBoardPaginationComponent = (searchOptions = {}, numberOfPages) => {
    const { statsType, page } = searchOptions
    const paginationActionsRow = new MessageActionRow()
    paginationActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaderboard_first_page_${statsType}`)
            .setLabel('<<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${statsType}_${page - 1}`)
            .setLabel('<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${statsType}_${page + 1}`)
            .setLabel('>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1),
        new MessageButton()
            .setCustomId(`leaderboard_last_page_${statsType}`)
            .setLabel('>>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1)
    )

    return paginationActionsRow
}

exports.createLineupEmbed = (rolesWithDiscordUsers, opponentLineup) => {
    let lineupEmbed = new MessageEmbed()
        .setColor('#6aa84f')
        .setTitle(opponentLineup ? `Lineup against ${teamService.formatTeamName(opponentLineup)}` : `${rolesWithDiscordUsers[0].lineupNumber === 1 ? 'Red' : 'Blue'} Team lineup`)

    let description = ''
    rolesWithDiscordUsers.map(roleWithDiscordUser => {
        description += `**${roleWithDiscordUser.name}:** `
        if (roleWithDiscordUser.user) {
            if (roleWithDiscordUser.user.emoji) {
                description += roleWithDiscordUser.user.emoji
            }

            description += roleWithDiscordUser.user.name
            if (roleWithDiscordUser.discordUser) {
                description += ` *(${roleWithDiscordUser.discordUser})*`
            }
        }
        description += '\n'
    })
    lineupEmbed.setDescription(description)

    return lineupEmbed
}

exports.createInformationEmbed = (author, description) => {
    return new MessageEmbed()
        .setColor('#566573')
        .setTimestamp()
        .setDescription(description)
        .setFooter({ text: `Author: ${author.username}` })
}

exports.createBanListEmbed = async (client, guildId) => {
    const banListEmbed = new MessageEmbed()
        .setColor('#566573')
        .setTitle(`Matchmaking Bans`)
    const bans = await teamService.findBansByGuildId(guildId)

    if (bans.length === 0) {
        banListEmbed.setDescription("✅ No user is banned")
    } else {
        for (let ban of bans) {
            const [user] = await handle(client.users.fetch(ban.userId))
            let username
            if (!user) {
                continue
            }
            username = user.username
            let bansEmbedFieldValue = '*Permanent*'
            if (ban.expireAt) {
                bansEmbedFieldValue = ban.expireAt.toUTCString()
            }
            if (ban.reason) {
                bansEmbedFieldValue += `***(Reason: ${ban.reason})***`
            }
            banListEmbed.addField(username, bansEmbedFieldValue)
        }
    }

    return banListEmbed
}

exports.createLineupComponents = createLineupComponents

function createLineupComponents(lineup, lineupQueue, challenge, selectedLineupNumber = 1) {
    components = createRolesComponent(lineup, selectedLineupNumber)

    const lineupActionsRow = new MessageActionRow()
    if (!lineup.isMix()) {
        if (challenge) {
            if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                lineupActionsRow.addComponents(
                    new MessageButton()
                        .setCustomId(`cancel_challenge_${challenge.id}`)
                        .setLabel(`Cancel Challenge`)
                        .setStyle('DANGER')
                )
            } else {
                lineupActionsRow.addComponents(
                    new MessageButton()
                        .setCustomId(`accept_challenge_${challenge.id}`)
                        .setLabel(`Accept`)
                        .setStyle('SUCCESS'),
                    new MessageButton()
                        .setCustomId(`refuse_challenge_${challenge.id}`)
                        .setLabel(`Refuse`)
                        .setStyle('DANGER')
                )
            }
        } else {
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
        }

        lineupActionsRow.addComponents(
            new MessageButton()
                .setCustomId(`leaveLineup`)
                .setLabel(`Leave`)
                .setStyle('DANGER')
        )
    }

    const numberOfSignedPlayers = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user != null).length
    const numberOfMissingPlayers = lineup.size - numberOfSignedPlayers
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`clearRole_${selectedLineupNumber}`)
            .setLabel("Clear a position")
            .setDisabled(numberOfSignedPlayers === 0)
            .setStyle('SECONDARY')
    )
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`addMerc_${selectedLineupNumber}`)
            .setLabel('Sign another player')
            .setDisabled(numberOfMissingPlayers === 0)
            .setStyle('SECONDARY')
    )
    components.push(lineupActionsRow)

    return components
}

function createRolesComponent(lineup, selectedLineupNumber = 1) {
    let components = []

    const gkActionRow = new MessageActionRow()
    const midfieldersActionRow = new MessageActionRow()
    const attackersActionRow = new MessageActionRow()
    const defendersActionRow = new MessageActionRow()

    const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
    for (let role of roles) {
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
                .setCustomId(`role_${role.name}_${selectedLineupNumber}`)
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

    return components
}

async function createReplyForTeamLineup(lineup, lineupQueue) {
    const challenge = await matchmakingService.findChallengeByChannelId(lineup.channelId)
    return { components: createLineupComponents(lineup, lineupQueue, challenge) }
}

function createReplyForMixLineup(lineup, challengingLineup) {
    let firstLineupEmbed = new MessageEmbed()
        .setColor('#ed4245')
        .setTitle(`Red Team`)
    fillLineupEmbedWithRoles(firstLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 1))

    let secondLineupEmbed
    if (challengingLineup) {
        secondLineupEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`:vs:`)
        let fieldValue = challengingLineup.roles.filter(role => role.user != null).length + ' players signed'
        if (!teamService.hasGkSigned(challengingLineup)) {
            fieldValue += ' **(no GK)**'
        }
        secondLineupEmbed.addField(teamService.formatTeamName(challengingLineup, false), fieldValue)
    } else {
        secondLineupEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Blue Team`)
            .setFooter({ text: 'If a Team faces the mix, it will replace the Blue Team' })
        fillLineupEmbedWithRoles(secondLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 2))
    }

    const lineupActionsComponent = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`mix_lineup_1`)
            .setLabel(`Red Team`)
            .setStyle('DANGER')
    )

    if (!challengingLineup) {
        lineupActionsComponent.addComponents(
            new MessageButton()
                .setCustomId(`mix_lineup_2`)
                .setLabel(`Blue Team`)
                .setStyle('PRIMARY')
        )
    }

    lineupActionsComponent.addComponents(
        new MessageButton()
            .setCustomId(`leaveLineup`)
            .setLabel(`Leave`)
            .setStyle('SECONDARY')
    )

    return { embeds: [firstLineupEmbed, secondLineupEmbed], components: [lineupActionsComponent] }
}

function createReplyForCaptainsLineup(lineup) {
    let lineupEmbed = new MessageEmbed()
        .setColor('#ed4245')
        .setTitle(`Player Queue`)
    fillLineupEmbedWithRoles(lineupEmbed, lineup.roles)

    const numberOfOutfieldUsers = lineup.roles.filter(role => !role.name.includes('GK') && role.user).length
    const numberOfGkUsers = lineup.roles.filter(role => role.name.includes('GK') && role.user).length
    const lineupActionsComponent = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`leaveQueue`)
            .setLabel(`Leave`)
            .setStyle('DANGER'),
        new MessageButton()
            .setCustomId(`join_outfield`)
            .setLabel(`Join`)
            .setStyle('PRIMARY')
            .setDisabled(numberOfOutfieldUsers === lineup.size * 2 - 2),
        new MessageButton()
            .setCustomId(`join_gk`)
            .setLabel(`Join as GK`)
            .setStyle('SECONDARY')
            .setDisabled(numberOfGkUsers === 2))

    return { embeds: [lineupEmbed], components: [lineupActionsComponent] }
}

function fillLineupEmbedWithRoles(lineupEmbed, roles) {
    let description = ''
    roles.map(role => {
        let playerName = ''
        if (role.user) {
            if (role.user.emoji) {
                playerName += role.user.emoji
            }
            playerName += role.user.name
        } else {
            playerName = '\u200b'
        }
        description += `**${role.name}:** ${playerName}\n`
    })
    lineupEmbed.setDescription(description)
}