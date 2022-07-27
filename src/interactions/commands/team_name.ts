import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE, MAX_TEAM_NAME_LENGTH } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('team_name')
        .setDescription('Let you edit the name of your team')
        .addStringOption(option => option.setName('name')
            .setRequired(true)
            .setDescription('The new name of your team')
        ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }
        
        const newName = interaction.options.getString('name')!
        if (!teamService.validateTeamName(newName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${MAX_TEAM_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }
        
        const duplicatedTeam = await teamService.findTeamByRegionAndName(team.region, newName)
        if (duplicatedTeam) {
            await interaction.reply({
                content: `⛔ Another team is already registered under the name **'${newName}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateTeamNameByGuildId(team.guildId, newName)
        await interaction.reply(`✅ Your new team name is **${newName}**`)
    },
} as ICommandHandler