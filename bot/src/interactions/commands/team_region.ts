import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService, TEAM_REGION_AS, TEAM_REGION_EU, TEAM_REGION_NA, TEAM_REGION_SA } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_region')
        .setDescription('Let you edit the region of your team')
        .addStringOption(option => option.setName('region')
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
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const newRegion = interaction.options.getString('region')!
        const duplicatedTeam = await teamService.findTeamByRegionAndName(newRegion, team.name)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${team.name}'** in the **${newRegion}** region. Please change your team neam using the /team_name command or select another region.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateTeamRegionByGuildId(team.guildId, newRegion)
        await interaction.reply(`✅ Your new team region is **${newRegion}**`)
    },
} as ICommandHandler