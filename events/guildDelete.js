const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
	name: 'guildDelete',
	async execute(guild) {
		matchmakingService.deleteChallengesByGuildId(guild.id)
		matchmakingService.freeLineupQueuesByGuildId(guild.id)
		teamService.deleteTeam(guild.id)
    }
};