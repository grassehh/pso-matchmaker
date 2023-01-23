import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { IPlayerBan, PlayerBans } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import parse from 'parse-duration'
import { userService } from "../../services/userService";

export default {
    data: new SlashCommandBuilder()
        .setName('player_ban')
        .setDescription('Ban a player from using the bot in this team')
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The player to ban'))
        .addStringOption(option => option.setName('reason')
            .setRequired(false)
            .setDescription('The reason of the ban'))
        .addStringOption(option => option.setName('duration')
            .setRequired(false)
            .setDescription('The duration of the ban (ex: 1d2h. Minimum 1h. Permanent ban if not specified)')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let duration = null
        const durationOption = interaction.options.getString('duration')
        if (durationOption != null) {
            duration = parse(durationOption)
            if (duration == null) {
                await interaction.reply({ content: `⛔ Unkown duration format ${durationOption}`, ephemeral: true })
                return
            }

            if (duration < 60 * 60 * 1000) {
                await interaction.reply({ content: `⛔ Please choose a duration greater than or equal to 1h`, ephemeral: true })
                return
            }
        }

        const player = interaction.options.getUser('player')!
        if (player.id === interaction.client.user?.id) {
            await interaction.reply({ content: `⛔ You cannot ban the bot !`, ephemeral: true })
            return
        }

        if (player.id === interaction.user.id) {
            await interaction.reply({ content: `⛔ You surely don't want to ban yourself !`, ephemeral: true })
            return
        }

        const reason = interaction.options.getString('reason');
        const now = Date.now()
        const expireAt = duration ? new Date(now + duration) : null
        const ban = { userId: player.id, guildId: team.guildId, reason, expireAt } as IPlayerBan

        await PlayerBans.updateOne({ userId: player.id, guildId: team.guildId }, ban, { upsert: true })
        await userService.notifyBanned(interaction.client, ban)
        await interaction.reply({ content: `Player **${player.username}** is now ${expireAt ? `banned until ${expireAt.toUTCString()}` : 'permanently banned'}` })
    }
} as ICommandHandler;