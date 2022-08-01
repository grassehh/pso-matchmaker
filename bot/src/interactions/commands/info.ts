import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Give information about your team'),
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)

        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const teamEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`Team information`)
            .setTimestamp()
            .addFields([
                { name: 'Name', value: team.name, inline: true },
                { name: 'Region', value: team.region, inline: true }
            ])

        await interaction.reply({
            embeds: [teamEmbed],
            ephemeral: true
        })
    },
} as ICommandHandler