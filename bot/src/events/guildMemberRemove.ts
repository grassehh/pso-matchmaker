import { GuildMember } from 'discord.js';
import { IEventHandler } from '../handlers/eventHandler';
import { teamService } from '../services/teamService';

export default {
	name: 'guildMemberRemove',
	async execute(guildMember: GuildMember) {
		await teamService.removeCaptain(guildMember.guild.id, guildMember.id)
		await teamService.removePlayer(guildMember.guild.id, guildMember.id)
	}
} as IEventHandler