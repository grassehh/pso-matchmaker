import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageActionRow, MessageButton } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('delete_team')
        .setDescription('Deletes this team'),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const deleteTeamActionRow = new MessageActionRow()
        deleteTeamActionRow.addComponents(
            new MessageButton()
                .setCustomId(`delete_team_yes_${team.guildId}`)
                .setLabel(`Yes`)
                .setStyle('DANGER'),
            new MessageButton()
                .setCustomId(`delete_team_no_${team.guildId}`)
                .setLabel(`No`)
                .setStyle('PRIMARY')
        )
        await interaction.reply({ content: '🛑 This will delete your team and all associated lineups', components: [deleteTeamActionRow], ephemeral: true })
    },
} as ICommandHandler