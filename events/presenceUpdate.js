const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldPresence, newPresence) {
		if (newPresence.status === 'offline') {
			let userId = oldPresence?.userId || newPresence.userId
			let channelIds = await teamService.findAllLineupChannelIdsByUserId(newPresence.userId)
			let result = await teamService.removeUserFromAllLineups(userId)
			if (result.modifiedCount > 0) {
				await matchmakingService.removeUserFromAllLineupQueues(userId)
				for (let channelId of channelIds) {
					newPresence.client.channels.fetch(channelId).then((channel) => {
						channel.send(`⚠ Player ${newPresence.user} went offline and has been removed from the lineup`)
					})
				}
			}
		}
	}
}