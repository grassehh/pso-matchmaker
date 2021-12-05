const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldPresence, newPresence) {
		if (newPresence.status === 'offline') {
			let userId = oldPresence?.userId || newPresence.userId
			let channelIds = await teamService.findAllLineupChannelIdsByUserId(userId)
			if (channelIds.length > 0) {
				Promise.all([teamService.removeUserFromLineupsByGuildId(userId, newPresence.guild.id), matchmakingService.removeUserFromLineupQueuesByGuildId(userId, newPresence.guild.id)]).then(res => {
					for (let channelId of channelIds) {
						newPresence.client.channels.fetch(channelId).then((channel) => {
							channel.send(`⚠ Player ${newPresence.user} went offline and has been removed from the lineup`)
						})
					}
				})
			}
		}
	}
}