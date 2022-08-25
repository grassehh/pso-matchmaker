import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a player from using the bot in this team')
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The mention (@...) or the id of the player to ban. For example: @Player or 123456789012345678'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const player = interaction.options.getUser('player')!
        const res = await teamService.deleteBanByUserIdAndGuildId(player.id, team.guildId)
        if (res.deletedCount === 0) {
            await interaction.reply({ content: `⛔ User **${player.username}** is not banned`, ephemeral: true })
            return
        }
        await interaction.reply({ content: `✅ Player **${player.username}** is now unbanned` })
        return
    }
} as ICommandHandler