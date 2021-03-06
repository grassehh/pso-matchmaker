import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE, MAX_TEAM_NAME_LENGTH } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { Team } from "../../mongoSchema";

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
                { name: 'Europe', value: 'EU' },
                { name: 'North America', value: 'NA' },
                { name: 'South America', value: 'SA' },
                { name: 'East Asia', value: 'AS' }
            )
        ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (team != null) {
            await interaction.reply({
                content: `⛔ You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
            return
        }

        const name = interaction.options.getString('team_name')!
        if (!teamService.validateTeamName(name)) {
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

        await new Team({
            guildId: interaction.guildId,
            name: interaction.options.getString('team_name'),
            region: interaction.options.getString('team_region')
        }).save()
        await interaction.reply({
            embeds: [interactionUtils.createInformationEmbed(interaction.user, '✅ Your team has been registered ! Use the /help command for more information about how to set up the lineups and use the matchmaking')],
            ephemeral: true
        })
    }
} as ICommandHandler