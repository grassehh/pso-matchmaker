const mongoose = require('mongoose');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		console.log('Connecting to database ...');
		await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
        console.log(`Ready! Logged in as ${client.user.tag}`);
    }
};