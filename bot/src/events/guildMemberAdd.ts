import { GuildMember } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { regionService } from '../services/regionService';
import { statsService } from '../services/statsService';
import { userService } from '../services/userService';

export default {
    name: 'guildMemberAdd',
    async execute(guildMember: GuildMember) {
        if (!regionService.isRegionalDiscord(guildMember.guild.id)) {
            return
        }

        const user = await userService.findUserByDiscordUserId(guildMember.id)
        if (!user) {
            return
        }

        const region = regionService.getRegionByGuildId(guildMember.guild.id)!
        const stats = await statsService.findPlayerStats(guildMember.id, region)
        if (!stats) {
            return
        }

        await regionService.updateMemberTierRole(region, guildMember, stats)
        await regionService.updateMemberActivityRole(region, guildMember, stats.numberOfRankedGames)
    }
} as IEventHandler