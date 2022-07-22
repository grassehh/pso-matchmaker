import { Channel, GuildChannel } from 'discord.js';
import { matchmakingService, teamService } from '../beans';
import { IEventHandler } from '../handlers/eventHandler';

export default {
    name: 'channelUpdate',
    async execute(oldChannel: Channel, newChannel: Channel) {
        if (!(oldChannel instanceof GuildChannel)) {
            return;
        }

        if (oldChannel.type !== 'GUILD_TEXT') {
            return;
        }

        if (!oldChannel.guild.me || !oldChannel.members.get(oldChannel.guild.me.user.id)) {
            return;
        }

        if (!(newChannel instanceof GuildChannel) || (newChannel.members.size < oldChannel.members.size && !newChannel.members.get(oldChannel.guild.me.user.id))) {
            matchmakingService.deleteChallengesByChannelId(oldChannel.id)
            matchmakingService.deleteLineupQueuesByChannelId(oldChannel.id)
            teamService.deleteLineup(oldChannel.id)
        }
    }
} as IEventHandler