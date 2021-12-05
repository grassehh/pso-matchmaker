const mongoose = require('mongoose');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
        console.log(`Ready! Logged in as ${client.user.tag}`);
    }
};