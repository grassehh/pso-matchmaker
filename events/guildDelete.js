const matchmakingService = require('../services/matchmakingService');
const teamService = require('../services/teamService');

module.exports = {
	name: 'guildDelete',
	async execute(guild) {		
		await matchmakingService.deleteChallengesByGuildId(guild.id)
		await matchmakingService.deleteLineupQueuesByGuildId(guild.id)
		await teamService.deleteLineupsByGuildId(guild.id)
		await teamService.deleteBansByGuildId(guild.id)
		await teamService.deleteTeam(guild.id)
    }
};