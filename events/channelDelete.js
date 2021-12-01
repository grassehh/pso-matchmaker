const { deleteLineup } = require('../services/teamService');

module.exports = {
	name: 'channelDelete',
	async execute(channel) {
		deleteLineup(channel.guildId, channel.id)
    }
};