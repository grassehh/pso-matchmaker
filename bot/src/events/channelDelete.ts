import { Channel } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { matchmakingService } from '../services/matchmakingService';
import { teamService } from '../services/teamService';

export default {
	name: 'channelDelete',
	async execute(channel: Channel) {
		await matchmakingService.deleteChallengesByChannelId(channel.id)
		await matchmakingService.deleteLineupQueuesByChannelId(channel.id)
		await teamService.deleteLineup(channel.id)
	}
} as IEventHandler