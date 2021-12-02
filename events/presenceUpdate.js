const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldPresence, newPresence) {
		if (newPresence.status === 'offline') {
			let userId = oldPresence?.userId || newPresence.userId
			let teams = await teamService.findTeamsByUserId(userId)
			if (teams.length > 0) {
				let updateResult = await teamService.removeUserFromTeams(userId)
				if (updateResult.modifiedCount > 0) {
					Promise.all([matchmakingService.removeUserFromAllChallenges(userId), teamService.removeUserFromAllLineupQueue(userId)]).then(res => {
						let allChannelIds = teams.flatMap(team => team.lineups).filter(lineup => lineup.roles.some(role => role.user?.id === userId)).map(lineup => lineup.channelId)
						for (let channelId of allChannelIds) {
							newPresence.client.channels.fetch(channelId).then((channel) => {
								channel.send(`⚠ Player ${newPresence.user} went offline or is afk. He has been removed from the lineup`)
							})
						}
					})
				}
			}
		}
	}
};