import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { Region, regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_region')
        .setDescription('Let you edit the region of your team')
        .addStringOption(option => option.setName('region')
            .setRequired(true)
            .setDescription('The region of your team')
            .addChoices(
                { name: regionService.getRegionData(Region.EUROPE).label, value: Region.EUROPE },
                { name: regionService.getRegionData(Region.NORTH_AMERICA).label, value: Region.NORTH_AMERICA },
                { name: regionService.getRegionData(Region.SOUTH_AMERICA).label, value: Region.SOUTH_AMERICA },
                { name: regionService.getRegionData(Region.EAST_ASIA).label, value: Region.EAST_ASIA },
                { name: regionService.getRegionData(Region.OCEANIA).label, value: Region.OCEANIA }
            )
        ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!) as ITeam
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const newRegion = interaction.options.getString('region')! as Region

        if (newRegion === team.region) {
            await interaction.reply({ content: `⛔ Your team is already in the ${newRegion} region`, ephemeral: true })
            return
        }

        const duplicatedTeam = await teamService.findTeamByRegionAndName(newRegion, team.name)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${team.name}'** in the **${newRegion}** region. Please change your team neam using the /team_name command or select another region.`,
                ephemeral: true
            })
            return
        }

        const teamWasVerified = team.verified
        team = await teamService.updateTeamRegionByGuildId(team.guildId, newRegion) as ITeam
        if (teamWasVerified) {
            await teamService.notifyNoLongerVerified(interaction.client, team)
        }
        await interaction.reply(`✅ Your team is now in the **${regionService.getRegionData(newRegion).label}** region`)
    },
} as ICommandHandler