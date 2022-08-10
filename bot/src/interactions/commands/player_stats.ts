import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ChatInputCommandInteraction, SelectMenuBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { Region } from "../../services/regionService";
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
        const region = team ? team.region : Region.INTERNATIONAL

        let player = interaction.options.getUser('player')
        let user = player ? player : interaction.user
        const statsTypeComponent = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
            new SelectMenuBuilder()
                .setCustomId(`stats_type_select_${user.id}`)
                .setPlaceholder('Stats Type')
                .addOptions([
                    {
                        emoji: '🌎',
                        label: 'International',
                        value: Region.INTERNATIONAL,
                        default: region === Region.INTERNATIONAL
                    },
                    {
                        emoji: '🇪🇺',
                        label: 'Europe',
                        value: Region.EUROPE,
                        default: region === Region.EUROPE
                    },
                    {
                        emoji: '🇺🇸',
                        label: 'North America',
                        value: Region.NORTH_AMERICA,
                        default: region === Region.NORTH_AMERICA
                    },
                    {
                        emoji: '🇧🇷',
                        label: 'South America',
                        value: Region.SOUTH_AMERICA,
                        default: region === Region.SOUTH_AMERICA
                    },
                    {
                        emoji: '🇰🇷',
                        label: 'East Asia',
                        value: Region.EAST_ASIA,
                        default: region === Region.EAST_ASIA
                    }
                ])
        )

        let statsEmbeds = await interactionUtils.createStatsEmbeds(interaction, user.id, region)
        await interaction.reply({ embeds: statsEmbeds, components: [statsTypeComponent], ephemeral: true })
    }
} as ICommandHandler;