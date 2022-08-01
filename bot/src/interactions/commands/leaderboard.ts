import { SlashCommandBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ChatInputCommandInteraction, SelectMenuBuilder } from "discord.js";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { statsService } from "../../services/statsService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(`Display stats of all players`),
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)

        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const globalLeaderboardComponent = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
            new SelectMenuBuilder()
                .setCustomId(`leaderboard_type_select`)
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


        const numberOfPlayers = await statsService.countNumberOfPlayers(team.region)
        const numberOfPages = Math.ceil(numberOfPlayers / DEFAULT_LEADERBOARD_PAGE_SIZE)
        const leaderboardEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region: team.region })
        const leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType: `region,${team.region}`, page: 0 }, numberOfPages)
        await interaction.reply({ embeds: leaderboardEmbeds, components: [leaderboardPaginationComponent, globalLeaderboardComponent], ephemeral: true })
    }
} as ICommandHandler;