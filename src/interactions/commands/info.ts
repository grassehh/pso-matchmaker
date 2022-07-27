import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Give information about your team'),
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const teamEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle(`Team information`)
            .setTimestamp()
        teamEmbed.addField('Name', team.name, true)
        teamEmbed.addField('Region', team.region, true)
        await interaction.reply({
            embeds: [teamEmbed],
            ephemeral: true
        })
    },
} as ICommandHandler