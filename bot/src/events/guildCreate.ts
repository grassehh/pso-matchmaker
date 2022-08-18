import { Guild } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';

export default {
	name: 'guildCreate',
	async execute(guild: Guild) {
		guild.client.user?.setActivity(`On ${guild.client.guilds.cache.size} servers`)
	}
} as IEventHandler