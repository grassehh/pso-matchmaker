const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { LineupQueue, Challenge } = require("../mongoSchema")
const teamService = require("../services/teamService");

exports.findLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOne({ 'lineup.channelId': channelId })
}

exports.reserveAndGetLineupQueueById = async (id) => {
    return await LineupQueue.findByIdAndUpdate(id, { reserved: true })
}

exports.reserveAndGetLineupQueueByChannelId = async (channelId) => {
    return await LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId }, { reserved: true })
}

exports.freeLineupQueueById = async (id) => {
    await LineupQueue.updateOne({ '_id': id }, { reserved: false })
}

exports.deleteLineupQueuesByGuildId = async (guildId) => {
    await LineupQueue.deleteMany({ 'team.guildId': guildId })
}

exports.deleteLineupQueueByChannelId = async (channelId) => {
    await LineupQueue.deleteMany({ 'lineup.channelId': channelId })
}

exports.findAvailableLineupQueues = async (region, channelId, lineupSize) => {
    return await LineupQueue.find({ 'lineup.channelId': { '$ne': channelId }, 'team.region': region, 'lineup.size': lineupSize, 'reserved': false })
}

exports.findChallengeById = async (id) => {
    return await Challenge.findById(id)
}

exports.findChallengeByGuildId = async (guildId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}

exports.findChallengeByChannelId = async (channelId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.deleteChallengesByGuildId = async (guildId) => {
    return await Challenge.deleteMany({ $or: [{ 'initiatingTeam.team.guildId': guildId }, { 'challengedTeam.team.guildId': guildId }] })
}

exports.deleteChallengesByChannelId = async (channelId) => {
    return await Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
}

exports.removeUserFromChallenge = async (guildId, channelId, userId) => {
    await Challenge.updateOne(
        {
            guildId,
            $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }],
        },
        {
            "$set": { "initiatingTeam.lineup.roles.$[inner].user": null },
            "$set": { "challengedTeam.lineup.roles.$[inner].user": null }
        },
        {
            "arrayFilters": [{ "inner.user.id": userId }]
        }
    )
}

exports.addUserToChallenge = async (guildId, channelId, roleName, user) => {
    await Challenge.updateOne(
        {
            guildId,
            $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }],
        },
        {
            "$set": { "initiatingTeam.lineup.roles.$[inner].user": user },
            "$set": { "challengedTeam.lineup.roles.$[inner].user": user }
        },
        {
            "arrayFilters": [{ "inner.name": roleName }]
        }
    )
}

exports.removeUserFromAllChallenges = async (userId) => {
    await Challenge.updateMany(
        {},
        {
            "$set": { "initiatingTeam.lineup.roles.$[inner].user": null },
            "$set": { "challengedTeam.lineup.roles.$[inner].user": null }
        },
        {
            "arrayFilters": [{ "inner.user.id": userId }]
        }
    )
}

exports.joinQueue = async (interaction, team, lineup) => {
    let lineupQueue = await new LineupQueue({
        team: team,
        lineup: lineup
    }).save()
    let teamName = teamService.formatTeamName(team, lineup)
    let channelIds = await teamService.findAllChannelIdToNotify(team.region, lineup.channelId, lineup.size)
    let notifyChannelPromises = []
    for (let channelId of channelIds) {
        notifyChannelPromises.push(interaction.client.channels.fetch(channelId).then((channel) => {
            const teamEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`Team '${teamName}' has joined the queue for ${lineup.size}v${lineup.size}`)
                .setTimestamp()
                .setFooter(`Author: ${interaction.user.username}`)

            let challengeTeamRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId(`challenge_${lineupQueue.id}`)
                    .setLabel('Challenge them !')
                    .setEmoji('⚽')
                    .setStyle('PRIMARY')
            )
            channel.send({ embeds: [teamEmbed], components: [challengeTeamRow] })
        }))
    }
    return Promise.all(notifyChannelPromises)
}

exports.isLineupAllowedToJoinQueue = (lineup) => {
    let numberOfPlayersSigned = lineup.roles.filter(role => role.user != null).length
    let numberOfMissingPlayers = lineup.size - numberOfPlayersSigned
    let missingRoleName = lineup.roles.find(role => role.user == null)?.name
    return numberOfMissingPlayers == 0 || (numberOfMissingPlayers == 1 && missingRoleName.includes('GK'))
}