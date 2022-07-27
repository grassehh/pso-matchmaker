import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageActionRow, MessageSelectMenu } from "discord.js";
import { interactionUtils, statsService, teamService } from "../../beans";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(`Display stats of all players`),
    async execute(interaction: CommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)

        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const globalLeaderboardComponent = new MessageActionRow().addComponents(
            new MessageSelectMenu()
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