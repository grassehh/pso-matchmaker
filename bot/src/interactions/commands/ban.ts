import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { Bans } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a player from using the bot in this team')
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The player to ban'))
        .addStringOption(option => option.setName('reason')
            .setRequired(false)
            .setDescription('The reason of the ban'))
        .addIntegerOption(option => option.setName('duration')
            .setRequired(false)
            .setDescription('The duration of the ban in days. A value of -1 means unlimited ban. (Default value is 1)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const duration = interaction.options.getInteger('duration') || -1
        if (duration != null && (duration != -1 && duration < 1)) {
            await interaction.reply({ content: `⛔ Please chose a duration of either -1 or greater than 0`, ephemeral: true })
            return
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
        let expireAt = null
        if (duration > 0) {
            expireAt = now + duration * 24 * 60 * 60 * 1000
        } else if (duration != -1) {
            expireAt = now + 24 * 60 * 60 * 1000
        }
        await Bans.updateOne({ userId: player.id, guildId: team.guildId }, { userId: player.id, reason, expireAt }, { upsert: true })

        let formattedDate
        if (expireAt) {
            formattedDate = new Date(expireAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: 'numeric' })
        }
        await interaction.reply({ content: `Player **${player.username}** is now ${formattedDate ? `banned until ${formattedDate}` : 'permanently banned'}` })
    }
} as ICommandHandler;