import { GuildMember } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { teamService } from '../services/teamService';

export default {
	name: 'guildMemberRemove',
	async execute(guildMember: GuildMember) {
		const team = await teamService.findTeamByGuildId(guildMember.guild.id)
		if (!team) {
			return
		}
		await teamService.removeCaptain(guildMember.guild.id, guildMember.id)
		await teamService.removePlayer(guildMember.guild.id, guildMember.id)

		if (team.verified) {
			await teamService.notifyNoLongerVerified(guildMember.client, team, `${guildMember.user} left the discord server.`)
		}
	}
} as IEventHandler