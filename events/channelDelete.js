const teamService = require('../services/teamService');

module.exports = {
	name: 'channelDelete',
	async execute(channel) {
		teamService.deleteLineup(channel.guildId, channel.id)
    }
};