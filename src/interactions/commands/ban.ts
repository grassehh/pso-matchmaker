import { SlashCommandBuilder, SlashCommandStringOption } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { Bans } from "../../mongoSchema";
import { getUserIdFromMention } from "../../utils";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a player from using the bot in this team')
        .addStringOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The mention (@...) or the id of the player to ban. For example: @Player or 123456789012345678'))
        .addStringOption(option => option.setName('reason')
            .setRequired(false)
            .setDescription('The reason of the ban'))
        .addIntegerOption(option => option.setName('duration')
            .setRequired(false)
            .setDescription('The duration of the ban in days. A value of -1 means unlimited ban. (Default value is 1)')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
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

        const player = interaction.options.getString('player')!
        const userId = (player.includes('@') ? getUserIdFromMention(player) : player) as string

        const user = interaction.client.users.resolve(userId)
        if (!user) {
            await interaction.reply({ content: `⛔ User '${player}' not found`, ephemeral: true })
            return
        }

        if (user.id === interaction.client.user?.id) {
            await interaction.reply({ content: `⛔ You cannot ban the bot !`, ephemeral: true })
            return
        }
        if (user.id === interaction.user.id) {
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
        await Bans.updateOne({ userId: user.id, guildId: team.guildId }, { userId: user.id, reason, expireAt }, { upsert: true })

        let formattedDate
        if (expireAt) {
            formattedDate = new Date(expireAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: 'numeric' })
        }
        await interaction.reply({ content: `Player **${user.username}** is now ${formattedDate ? `banned until ${formattedDate}` : 'permanently banned'}`, ephemeral: true })
    }
} as ICommandHandler;