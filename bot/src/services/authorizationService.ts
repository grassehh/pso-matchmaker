import { ChannelType, GuildMember, Interaction, PermissionsBitField, Role, User as DiscordUser } from "discord.js";
import { BOT_ADMIN_ROLE } from "../constants";
import { ICommandHandler } from "../handlers/commandHandler";
import { IUser, User } from "../mongoSchema";
import { userService } from "./userService";
const dotenv = require("dotenv")
dotenv.config()

class AuthorizationService {
    isBotAllowed(interaction: Interaction) {
        if (interaction.channel?.type !== ChannelType.GuildText) {
            return false
        }

        if (!interaction.guild?.members.me) {
            return null
        }

        return interaction.channel.permissionsFor(interaction.guild.members.me).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]);
    }

    async isSteamAccountLinked(discordUser: DiscordUser): Promise<boolean> {
        let user = await userService.findUserByDiscordUserId(discordUser.id)
        if (!user) {
            await new User({
                id: discordUser.id,
                name: discordUser.username,
                mention: discordUser.toString()
            } as IUser).save()
            return false
        }

        return user.steamId !== undefined
    }

    isAllowedToExecuteCommand(command: ICommandHandler, member: GuildMember) {
        return !command.authorizedRoles
            || member.permissions.has(PermissionsBitField.Flags.Administrator)
            || member.roles.cache.some((role: Role) => command.authorizedRoles?.includes(role.name.toUpperCase()) === true);
    }

    isMatchmakingAdmin(member: GuildMember) {
        return member.permissions.has(PermissionsBitField.Flags.Administrator)
            || member.roles.cache.some((role: Role) => role.name.toUpperCase() === BOT_ADMIN_ROLE);
    }
}

export const authorizationService = new AuthorizationService()