import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('ban_list')
        .setDescription('Display a list of banned players')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const banListEmbed = await interactionUtils.createBanListEmbed(interaction.client, interaction.guildId!)

        await interaction.reply({ embeds: [banListEmbed], ephemeral: true })
    }
} as ICommandHandler;