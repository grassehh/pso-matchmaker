const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");
const teamService = require("../services/teamService");
const statsService = require("../services/statsService");
const matchmakingService = require("../services/matchmakingService");
const { Stats } = require("../mongoSchema");

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `❌ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command.`,
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

exports.createCancelChallengeReply = (challenge) => {
    let cancelChallengeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`cancel_challenge_${challenge.id}`)
                .setLabel(`Cancel Request`)
                .setStyle('DANGER')
        )
    return { content: `💬 You have sent a challenge request to the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'. You can either wait for their answer, or cancel your request.`, components: [cancelChallengeRow] }
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

exports.createLineupComponents = (lineup) => {

    let components = []
    for (var i = 0; i < lineup.roles.length; i++) {
        if (i % 4 === 0) {
            components.push(new MessageActionRow())
        }

        let playerRole = lineup.roles[i]
        components[components.length - 1].addComponents(
            new MessageButton()
                .setCustomId(`role_${playerRole.name}`)
                .setLabel(playerRole.user == null ? playerRole.name : `${playerRole.name}: ${playerRole.user.name}`)
                .setStyle('PRIMARY')
                .setDisabled(playerRole.user != null)
        )
    }

    const lineupActionsRow = new MessageActionRow()
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaveLineup`)
            .setLabel(`Leave`)
            .setStyle('DANGER')
    )
    components.push(lineupActionsRow)

    return components
}

exports.replyNotAllowed = async (interaction) => {
    await interaction.reply({ content: '❌ You are not allowed to execute this command', ephemeral: true })
}

exports.createStatsEmbeds = async (interaction, user, guildId) => {
    let stats = await statsService.findStatsByUserId(user.id, guildId)
    if (!stats) {
        stats = new Stats({
            numberOfGames: 0
        })
    }
    const statsEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`${user.tag} ${guildId ? 'team' : 'global'} stats`)
        .setTimestamp()
        .setFooter(`Author: ${interaction.user.username}`)
    statsEmbed.addField('⚽ Games played', stats.numberOfGames.toString())

    return [statsEmbed]
}

exports.createLeaderBoardEmbeds = async (interaction, guildId, page = 0, numberOfPages, pageSize = statsService.DEFAULT_LEADERBOARD_PAGE_SIZE) => {
    let allStats = await statsService.findStats(guildId, page, pageSize)

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
            let user = await interaction.client.users.fetch(stats.user.id)
            if (user) {
                let isLeader = pos === 1 && page === 0
                let isTop3 = pos <= 3
                playersStats += `${isTop3 ? '**' : ''}${pos}. ${isLeader ? '🏆 ' : ''} ${user.username} (${stats.totalNumberOfGames || stats.numberOfGames})${isLeader ? ' 🏆' : ''}${isTop3 ? '**' : ''}\n`
                pos++
            }
        }

        statsEmbed.addField(`Page ${page + 1}/${numberOfPages}`, playersStats)
    }

    return [statsEmbed]
}

exports.createLeaderBoardPaginationComponent = (globalStats, page = 0, numberOfPages) => {
    const paginationActionsRow = new MessageActionRow()
    paginationActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaderboard_first_page_${globalStats}`)
            .setLabel('<<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${page - 1}`)
            .setLabel('<')
            .setStyle('SECONDARY')
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(`leaderboard_page_${globalStats}_${page + 1}`)
            .setLabel('>')
            .setStyle('SECONDARY')
            .setDisabled(page >= numberOfPages - 1),
        new MessageButton()
            .setCustomId(`leaderboard_last_page_${globalStats}`)
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
    
    let i = 1
    for (role of lineup.roles) {
        let playerName = '*empty*'
        if (role.user) {
            let discordUser = await interaction.client.users.fetch(role.user.id)
            if (discordUser) {
                let channelIds = await teamService.findAllLineupChannelIdsByUserId(role.user.id)
                if (channelIds.length > 0) {
                    await teamService.removeUserFromLineupsByChannelIds(role.user.id, channelIds)
                    for (let channelId of channelIds) {
                        let channel = await interaction.client.channels.fetch(channelId)
                        await channel.send(`⚠ Player ${discordUser} has gone to play another match. He has been removed from the lineup.`)
                    }
                }
                await discordUser.send(`⚽ Match is ready ! Join the custom lobby Lobby **${lobbyName}**. The password is **${lobbyPassword}**`)
                playerName = discordUser
            }
        }
        lineupEmbed.addField(role.name, playerName.toString(), i % 4 !== 0)
    }

    return lineupEmbed
}