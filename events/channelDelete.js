const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'channelDelete',
	async execute(channel) {
		matchmakingService.deleteChallengesByChannelId(channel.id)
		matchmakingService.deleteLineupQueuesByGuildId(channel.guildId)
		teamService.deleteLineup(channel.guildId, channel.id)
    }
};