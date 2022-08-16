import { Presence } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { teamService } from '../services/teamService';

export default {
	name: 'presenceUpdate',
	async execute(oldPresence: Presence, newPresence: Presence) {
		if (newPresence.status === 'offline' || newPresence.status === 'idle') {
			const userId = oldPresence?.userId || newPresence.userId
			const guildId = oldPresence?.guild?.id || newPresence.guild?.id || undefined
			const channelIds = await teamService.findAllLineupChannelIdsByUserId(userId, [], guildId)

			if (channelIds.length === 0) {
				return
			}

			if (newPresence.status === 'offline') {
				await Promise.all(channelIds.map(async channelId => {
					await teamService.notifyChannelForUserLeaving(newPresence.client, newPresence.user!, channelId, `⚠ Player ${newPresence.user} went offline and has been removed from the lineup`)
				}))
			}
		}
	}
} as IEventHandler