const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, replyLineupNotSetup, retrieveLineup, replyTeamNotRegistered, replyAlreadyQueued, replyAlreadyChallenging } = require('../services');
const { findChallengeByGuildId } = require('../services/matchmakingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Put your team in the matchmaking queue'),
    async execute(interaction) {
        let challenge = await findChallengeByGuildId(interaction.guildId)
        if (challenge) {
            await replyAlreadyChallenging(interaction, challenge)
            return
        }
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }
        let lineup = retrieveLineup(interaction.channelId, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }

        let currentQueuedLineup = await LineupQueue.findOne({ 'lineup.channelId': interaction.channelId })
        if (currentQueuedLineup) {
            replyAlreadyQueued(interaction, currentQueuedLineup.lineup.size)
            return
        }

        await new LineupQueue({
            team: {
                guildId: team.guildId,
                name: team.name,
                region: team.region
            },
            lineup: lineup
        }).save()
        await interaction.reply(`✅ Your team is now queued for ${lineup.size}v${lineup.size}`)
    }
};