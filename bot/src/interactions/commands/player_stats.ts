import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ChatInputCommandInteraction, SelectMenuBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('player_stats')
        .setDescription("Display your own stats or another player's stats")
        .addUserOption(option => option.setName('player')
            .setRequired(false)
            .setDescription('The player you to see the stats')),
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let player = interaction.options.getUser('player')
        let user = player ? player : interaction.user
        const statsTypeComponent = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
            new SelectMenuBuilder()
                .setCustomId(`stats_type_select_${user.id}`)
                .setPlaceholder('Stats Type')
                .addOptions([
                    {
                        label: '🌎 Global Stats',
                        value: 'global'
                    },
                    {
                        label: '⛺ Region Stats',
                        value: `region,${team.region}`
                    }
                ])
        )

        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, user.id, team.region)
        await interaction.reply({ embeds: statsEmbeds, components: [statsTypeComponent], ephemeral: true })
    }
} as ICommandHandler;