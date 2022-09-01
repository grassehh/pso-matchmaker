import { GuildMember } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { regionService } from '../services/regionService';
import { teamService } from '../services/teamService';
import { handle } from '../utils';

export default {
	name: 'guildMemberRemove',
	async execute(guildMember: GuildMember) {
		const team = await teamService.findTeamByGuildId(guildMember.guild.id)
		if (!team || !team.hasPlayerOrCaptain(guildMember.id)) {
			return
		}

		await teamService.removeCaptain(guildMember.guild.id, guildMember.id)
		await teamService.removePlayer(guildMember.guild.id, guildMember.id)
		const [regionDiscord] = await handle(guildMember.client.guilds.fetch(regionService.getRegionData(team.region).guildId))
		await regionService.removeTeamCodeFromNickName(guildMember.id, regionDiscord)

		if (team.verified) {
			await teamService.notifyNoLongerVerified(guildMember.client, team, `${guildMember.user} left the discord server.`)
		}
	}
} as IEventHandler