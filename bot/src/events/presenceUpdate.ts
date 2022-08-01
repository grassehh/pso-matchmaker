import { Presence, TextChannel } from 'discord.js';
import { matchmakingService } from '../services/matchmakingService';
import { teamService } from '../services/teamService';
import { handle } from '../utils';
import { IEventHandler } from '../handlers/eventHandler';

export default {
	name: 'presenceUpdate',
	async execute(oldPresence: Presence, newPresence: Presence) {
		if (newPresence.status === 'offline' || newPresence.status === 'idle') {
			const userId = oldPresence?.userId || newPresence.userId
			const channelIds = await teamService.findAllLineupChannelIdsByUserId(newPresence.userId)

			if (channelIds.length === 0) {
				return
			}

			if (newPresence.status === 'offline') {
				let result = await teamService.removeUserFromAllLineups(userId)
				if (result.modifiedCount > 0) {
					await matchmakingService.removeUserFromAllLineupQueues(userId)
					await Promise.all(channelIds.map(async channelId => {
						await teamService.notifyChannelForUserLeaving(newPresence.client, newPresence.user!, channelId, `⚠ Player ${newPresence.user} went offline and has been removed from the lineup`)
					}))
				}
			}

			if (newPresence.status === 'idle' && newPresence.guild) {
				let channelIds = await teamService.findChannelIdsFromGuildIdAndUserId(newPresence.guild.id, userId)
				await Promise.all(channelIds.map(async channelId => {
					const [channel] = await handle(newPresence.client.channels.fetch(channelId))
					if (channel instanceof TextChannel) {
						await handle(channel.send(`⚠ ${newPresence.user} might be AFK ...`))
					}
				}))
			}
		}
	}
} as IEventHandler