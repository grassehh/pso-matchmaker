import { ChannelType, GuildMember, Interaction, PermissionsBitField, Role } from "discord.js";
import { BOT_ADMIN_ROLE } from "../constants";
import { ICommandHandler } from "../handlers/commandHandler";
const dotenv = require("dotenv")
dotenv.config()

class AuthorizationService {
    readonly officialDiscordIds = [
        process.env.PSO_EU_DISCORD_GUILD_ID,
        process.env.PSO_NA_DISCORD_GUILD_ID,
        process.env.PSO_SA_DISCORD_GUILD_ID,
        process.env.PSO_AS_DISCORD_GUILD_ID
    ]


    isBotAllowed(interaction: Interaction) {
        if (interaction.channel?.type !== ChannelType.GuildText) {
            return false
        }

        if (!interaction.guild?.members.me) {
            return null
        }

        return interaction.channel.permissionsFor(interaction.guild.members.me).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]);
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

    isOfficialDiscord(guildId: string) {
        return this.officialDiscordIds.includes(guildId)
    }
}

export const authorizationService = new AuthorizationService()