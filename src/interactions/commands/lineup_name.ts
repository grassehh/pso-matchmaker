import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE, MAX_LINEUP_NAME_LENGTH } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('lineup_name')
        .setDescription('Let you edit the name of the lineup')
        .addStringOption(option => option.setName('name')
            .setRequired(false)
            .setDescription('The new name of the lineup (leave it empty to remove the name)')
        ),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const newName = interaction.options.getString("name") || undefined
        if (newName && !teamService.validateLineupName(newName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${MAX_LINEUP_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateLineupNameByChannelId(interaction.channelId, newName)
        await interaction.reply(`✅ Your new lineup name is **${newName ? newName : "*empty*"}**`)
    },
} as ICommandHandler