const teamService = require('../services/teamService');

module.exports = {
	name: 'presenceUpdate',
	async execute(oldMember, newMember) {
		if (newMember.status === 'offline') {
			let team = await teamService.findTeamByGuildId(oldMember.guild.id)
			if (team) {
				for (lineup of team.lineups) {
					let playerRole = lineup.roles.find(role => role.user?.id === oldMember.userId)
					if (playerRole) {
						playerRole.user = null
					}
				}
				await team.save()
			 	await teamService.removeUserFromAllLineupQueue(oldMember.guild.id, oldMember.userId)	
			}
		}
    }
};