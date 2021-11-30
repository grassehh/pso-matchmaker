const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { deleteLineup } = require('../services/teamService');
dotenv.config()

module.exports = {
	name: 'channelDelete',
	once: true,
	async execute(channel) {
		deleteLineup(channel.guildId, channel.id)
    }
};