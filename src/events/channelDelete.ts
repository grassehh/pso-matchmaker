import { Channel } from 'discord.js';
import { matchmakingService, teamService } from '../beans';
import { IEventHandler } from '../handlers/eventHandler';

export default {
	name: 'channelDelete',
	async execute(channel: Channel) {
		await matchmakingService.deleteChallengesByChannelId(channel.id)
		await matchmakingService.deleteLineupQueuesByChannelId(channel.id)
		await teamService.deleteLineup(channel.id)
	}
} as IEventHandler