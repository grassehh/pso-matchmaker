const { retrieveTeam } = require('../services');
const { removeUserFromAllLineupQueue } = require('../services/teamService');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldMember, newMember) {
		if (newMember.status === 'offline') {
			let team = await retrieveTeam(oldMember.guild.id)
			if (team) {
				for (lineup of team.lineups) {
					let playerRole = lineup.roles.find(role => role.user?.id === oldMember.userId)
					if (playerRole) {
						playerRole.user = null
					}
				}
				await team.save()
			 	await removeUserFromAllLineupQueue(oldMember.guild.id, oldMember.userId)	
			}
		}
    }
};