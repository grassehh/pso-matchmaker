import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { regionService } from "../../services/regionService";
import { userService } from "../../services/userService";
import { statsService } from "../../services/statsService";
import { PlayerStats } from "../../mongoSchema";

export default {
    data: new SlashCommandBuilder()
        .setName('account_migrate')
        .setDescription("Migrates a player account to a new Discord user")
        .addUserOption(option => option.setName('old_user')
            .setRequired(true)
            .setDescription('The discord user mention (@) or ID from which you want to migrate the account'))
        .addUserOption(option => option.setName('new_user')
            .setRequired(true)
            .setDescription('The discord user mention (@) or ID to which you want to migrate the account')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isRegionalDiscord(interaction.guild!.id)) {
            await interaction.reply({ content: '⛔ Only regional discords can use this command', ephemeral: true })
            return;
        }

        const oldUser = interaction.options.getUser('old_user')
        if (!oldUser) {
            await interaction.reply({ content: '⛔ Invalid old user: You must specify either a user or a steam id', ephemeral: true })
            return
        }
        if (oldUser.bot) {
            await interaction.reply({ content: '⛔ Old user is a bot', ephemeral: true })
            return
        }

        const newUser = interaction.options.getUser('new_user')
        if (!newUser) {
            await interaction.reply({ content: '⛔ Invalid new user: You must specify either a user or a steam id', ephemeral: true })
            return
        }
        if (newUser.bot) {
            await interaction.reply({ content: '⛔ New user is a bot', ephemeral: true })
            return
        }

        if (oldUser == newUser) {
            await interaction.reply({ content: '⛔ Old user and new user are the same', ephemeral: true })
            return
        }

        const oldUserInDb = await userService.findUserByDiscordUserId(oldUser.id)
        if (!oldUserInDb) {
            await interaction.reply({ content: '⛔ The old user is not registered in PSO Matchmaker', ephemeral: true })
            return
        }

        const newUserInDb = await userService.findUserByDiscordUserId(newUser.id) || await userService.createUserFromDiscordUser(newUser)
        await userService.updateSteamId(newUserInDb.id, oldUserInDb.steamId)

        const region = regionService.getRegionByGuildId(interaction.guildId!!)!
        const oldPlayerStats = await statsService.findPlayerStats(oldUser.id, region) || statsService.createDefaultPlayerStats(oldUser.id, region)
        const newPlayerStats = await statsService.findPlayerStats(newUser.id, region) || statsService.createDefaultPlayerStats(oldUser.id, region)
        await PlayerStats.updateOne(
            { userId: newUser.id },
            {
                userId: newUser.id,
                region,
                numberOfRankedGames: oldPlayerStats.numberOfRankedGames + newPlayerStats.numberOfRankedGames,
                numberOfRankedWins: oldPlayerStats.numberOfRankedWins + newPlayerStats.numberOfRankedWins,
                numberOfRankedDraws: oldPlayerStats.numberOfRankedDraws + newPlayerStats.numberOfRankedDraws,
                numberOfRankedLosses: oldPlayerStats.numberOfRankedLosses + newPlayerStats.numberOfRankedLosses,
                totalNumberOfRankedWins: oldPlayerStats.totalNumberOfRankedWins + newPlayerStats.totalNumberOfRankedWins,
                totalNumberOfRankedDraws: oldPlayerStats.totalNumberOfRankedDraws + newPlayerStats.totalNumberOfRankedDraws,
                totalNumberOfRankedLosses: oldPlayerStats.totalNumberOfRankedLosses + newPlayerStats.totalNumberOfRankedLosses,
                rating: oldPlayerStats.rating,
                mixCaptainsRating: oldPlayerStats.mixCaptainsRating
            },
            { upsert: true }
        )

        await userService.deleteUser(interaction.client, oldUser)
        await interaction.reply({ content: `User account has been succesfully migrated from **${oldUser.username}** to **${newUser.username}**` })
    }
} as ICommandHandler;
