import { GuildChannel, GuildMember, Interaction, Permissions, Role } from "discord.js";
import { BOT_ADMIN_ROLE } from "../constants";
import { ICommandHandler } from "../handlers/commandHandler";

export default class AuthorizationService {
    isBotAllowed(interaction: Interaction) {
        if (!(interaction.channel instanceof GuildChannel)) {
            return false
        }

        if (!interaction.guild?.me) {
            return null
        }

        return interaction.channel.isText()
            && interaction.channel.permissionsFor(interaction.guild.me).has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]);
    }

    isAllowedToExecuteCommand(command: ICommandHandler, member: GuildMember) {
        return !command.authorizedRoles
            || member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
            || member.roles.cache.some((role: Role) => command.authorizedRoles?.includes(role.name.toUpperCase()) === true);
    }

    isMatchmakingAdmin(member: GuildMember) {
        return member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
            || member.roles.cache.some((role: Role) => role.name.toUpperCase() === BOT_ADMIN_ROLE);
    }
}