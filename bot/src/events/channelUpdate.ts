import { Channel, ChannelType, GuildChannel } from 'discord.js';
import { matchmakingService } from '../services/matchmakingService';
import { teamService } from '../services/teamService';
import { IEventHandler } from '../handlers/eventHandler';

export default {
    name: 'channelUpdate',
    async execute(oldChannel: Channel, newChannel: Channel) {
        if (oldChannel.type !== ChannelType.GuildText) {
            return;
        }

        if (!oldChannel.guild.members.me || !oldChannel.members.get(oldChannel.guild.members.me.user.id)) {
            return;
        }

        if (!(newChannel instanceof GuildChannel) || (newChannel.members.size < oldChannel.members.size && !newChannel.members.get(oldChannel.guild.members.me.user.id))) {
            matchmakingService.deleteChallengesByChannelId(oldChannel.id)
            matchmakingService.deleteLineupQueuesByChannelId(oldChannel.id)
            teamService.deleteLineup(oldChannel.id)
        }
    }
} as IEventHandler