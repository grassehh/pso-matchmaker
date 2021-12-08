const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');
const { handle } = require('../utils');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldPresence, newPresence) {
		if (newPresence.status === 'offline' || newPresence.status === 'idle') {
			let userId = oldPresence?.userId || newPresence.userId
			let channelIds = await teamService.findAllLineupChannelIdsByUserId(newPresence.userId)

			if (newPresence.status === 'offline') {
				let result = await teamService.removeUserFromAllLineups(userId)
				if (result.modifiedCount > 0) {
					await matchmakingService.removeUserFromAllLineupQueues(userId)
					await Promise.all(channelIds.map(async channelId => {
						await teamService.notifyChannelForUserLeaving(newPresence.client, channelId, `⚠ Player ${newPresence.user} went offline and has been removed from the lineup`)
					}))
				}
			}

			if (newPresence.status === 'idle') {
				let channelIds = await teamService.findChannelIdsFromGuildIdAndUserId(newPresence.guild.id, userId)
				await Promise.all(channelIds.map(async channelId => {
					const [channel] = await handle(newPresence.client.channels.fetch(channelId))
					if (channel) {
						await handle(channel.send(`⚠ Player ${newPresence.user} might be AFK ...`))
					}
				}))
			}
		}
	}
}