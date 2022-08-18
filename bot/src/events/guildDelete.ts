import { Guild } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { teamService } from '../services/teamService';

export default {
	name: 'guildDelete',
	async execute(guild: Guild) {
		await teamService.deleteTeam(guild.id)
	}
} as IEventHandler