import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_bans')
        .setDescription('Display a list of banned teams'),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const banListEmbeds = await interactionUtils.createTeamBanListEmbeds(regionService.getRegionByGuildId(interaction.guildId!)!)

        await interaction.reply({ embeds: banListEmbeds, ephemeral: true })
    }
} as ICommandHandler;