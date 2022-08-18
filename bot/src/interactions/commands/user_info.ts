import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { userService } from "../../services/userService";

export default {
    data: new SlashCommandBuilder()
        .setName('user_info')
        .setDescription("Display information about a user")
        .addUserOption(option => option.setName('user')
            .setRequired(false)
            .setDescription('The discord user mention (@) or ID you want to get information about'))
        .addStringOption(option => option.setName('steam_id')
            .setRequired(false)
            .setDescription('The Steam ID of the user you want to get information about'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user')
        const steamId = interaction.options.getString('steam_id')

        if (!user && !steamId) {
            await interaction.reply({ content: '⛔ You must specify either a user or a steam id', ephemeral: true })
            return
        }

        let userInDb
        if (user) {
            userInDb = await userService.findUserByDiscordUserId(user.id)
        } else {
            userInDb = await userService.findUserBySteamId(steamId!)
        }

        if (!userInDb) {
            await interaction.reply({ content: '⛔ This user does not exist', ephemeral: true })
            return
        }

        const userInfoEmbed = new EmbedBuilder()
            .setTitle(`User information`)
            .addFields([
                { name: 'Discord ID', value: userInDb.id, inline: true },
                { name: 'Discord Name', value: userInDb.name, inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: 'Steam ID', value: userInDb.steamId ? userInDb.steamId : '*Account not linked*', inline: true },
                { name: 'Steam profile', value: userInDb.steamId ? `https://steamcommunity.com/profiles/${userInDb.steamId}` : '*Account not linked*', inline: true },
            ])


        await interaction.reply({ embeds: [userInfoEmbed], ephemeral: true })
    }
} as ICommandHandler;