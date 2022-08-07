import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_manage')
        .setDescription('Manage teams')
        .addStringOption(option => option.setName('team_id')
            .setRequired(false)
            .setDescription('The id of the team to manage')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let teamId = interaction.options.getString('team_id')!
        if (teamId && !authorizationService.isOfficialDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only official discords can manager other teams that yours', ephemeral: true })
            return
        }

        teamId = teamId || interaction.guildId!
        const team = await teamService.findTeamByGuildId(teamId)
        if (!team) {
            await interaction.reply({ content: '⛔ This team does not exist', ephemeral: true })
            return
        }

        await interaction.reply(interactionUtils.createTeamManagementReply(interaction, team))
    }
} as ICommandHandler;