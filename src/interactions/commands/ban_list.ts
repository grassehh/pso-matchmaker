import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('ban_list')
        .setDescription('Display a list of banned players'),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const banListEmbed = await interactionUtils.createBanListEmbed(interaction.client, interaction.guildId!)

        await interaction.reply({ embeds: [banListEmbed], ephemeral: true })
    }
} as ICommandHandler;