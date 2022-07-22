import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { getUserIdFromMention } from "../../utils";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a player from using the bot in this team')
        .addStringOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The mention (@...) or the id of the player to ban. For example: @Player or 123456789012345678')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const player = interaction.options.getString('player')!
        const userId = player.includes('@') ? (getUserIdFromMention(player) || player) : player
        const user = interaction.client.users.resolve(userId)
        if (!user) {
            await interaction.reply({ content: `⛔ User '${player}' not found`, ephemeral: true })
            return
        }

        const res = await teamService.deleteBanByUserIdAndGuildId(user.id, team.guildId)
        if (res.deletedCount === 0) {
            await interaction.reply({ content: `⛔ User **${user.username}** is not banned`, ephemeral: true })
            return
        }
        await interaction.reply({ content: `✅ Player **${user.username}** is now unbanned`, ephemeral: true })
        return
    }
} as ICommandHandler