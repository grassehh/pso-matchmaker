import { Guild } from 'discord.js';
import { matchmakingService, teamService } from '../beans';
import { IEventHandler } from '../handlers/eventHandler';

export default {
	name: 'guildDelete',
	async execute(guild: Guild) {		
		await matchmakingService.deleteChallengesByGuildId(guild.id)
		await matchmakingService.deleteLineupQueuesByGuildId(guild.id)
		await teamService.deleteLineupsByGuildId(guild.id)
		await teamService.deleteBansByGuildId(guild.id)
		await teamService.deleteTeam(guild.id)
    }
} as IEventHandler