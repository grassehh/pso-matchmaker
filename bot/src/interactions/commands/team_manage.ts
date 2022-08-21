import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_manage')
        .setDescription('Manage your team')
        .addStringOption(option => option.setName('team_id')
            .setRequired(false)
            .setDescription('The id of the team to manage (default is your team)')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const teamId = interaction.options.getString('team_id')!
        let team: ITeam | null

        if (teamId) {
            if (!regionService.isOfficialDiscord(interaction.guildId!)) {
                await interaction.reply({ content: '⛔ Only official discords can manage other teams than yours', ephemeral: true })
                return
            }

            team = await teamService.findTeamByGuildId(teamId)
            if (!team) {
                await interaction.reply({ content: '⛔ This team does not exist', ephemeral: true })
                return
            }

            if (regionService.getRegionByGuildId(interaction.guildId!) !== team.region) {
                await interaction.reply({ content: '⛔ You cannot manage teams that are in other regions', ephemeral: true })
                return
            }
        } else {
            team = await teamService.findTeamByGuildId(interaction.guildId!)
            if (!team) {
                await interaction.reply({ content: '⛔ This team does not exist', ephemeral: true })
                return
            }
        }

        await interaction.reply(interactionUtils.createTeamManagementReply(interaction, team))
    }
} as ICommandHandler;