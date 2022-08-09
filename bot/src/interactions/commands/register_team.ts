import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE, MAX_TEAM_NAME_LENGTH } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ITeam, Team } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService, TEAM_REGION_AS, TEAM_REGION_EU, TEAM_REGION_NA, TEAM_REGION_SA } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('register_team')
        .setDescription('Register your team against PSO matchmaker so you can start using the matchmaking')
        .addStringOption(option => option.setName('team_name')
            .setRequired(true)
            .setDescription('The name of your team')
        )
        .addStringOption(option => option.setName('team_region')
            .setRequired(true)
            .setDescription('The region of your team')
            .addChoices(
                { name: 'Europe', value: TEAM_REGION_EU },
                { name: 'North America', value: TEAM_REGION_NA },
                { name: 'South America', value: TEAM_REGION_SA },
                { name: 'East Asia', value: TEAM_REGION_AS }
            )
        ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (team != null) {
            await interaction.reply({
                content: `⛔ You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
            return
        }

        const name = teamService.validateTeamName(interaction.options.getString('team_name')!)
        if (name === null) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${MAX_TEAM_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        const region = interaction.options.getString('team_region')!
        const duplicatedTeam = await teamService.findTeamByRegionAndName(region, name)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${name}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        team = await new Team({
            guildId: interaction.guildId,
            name,
            region,
            nameUpperCase: name.toUpperCase()
        }).save() as ITeam
        await interaction.reply({ embeds: [interactionUtils.createInformationEmbed(interaction.user, '✅ Your team has been registered !')], ephemeral: true })
        await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
    }
} as ICommandHandler