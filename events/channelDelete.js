const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'channelDelete',
	async execute(channel) {
		await matchmakingService.deleteChallengesByChannelId(channel.id)
		await matchmakingService.deleteLineupQueuesByChannelId(channel.id)
		await teamService.deleteLineup(channel.id)
    }
};