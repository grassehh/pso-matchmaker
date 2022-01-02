const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const interactionUtils = require("../services/interactionUtils");
const statsService = require("../services/statsService");
const teamService = require("../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(`Display stats of all players`),
    async execute(interaction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId)

        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
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
                    },
                    {
                        label: '👕 Team Stats',
                        value: 'team',
                    },
                ])
        )


        const numberOfPlayers = await statsService.countNumberOfPlayers(team.region)
        const numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        const leaderboardEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages, { region: team.region })
        const leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ statsType: `region,${team.region}`, page: 0, lineupSizes: [] }, numberOfPages)
        const lineupSizeComponent = interactionUtils.createLeaderBoardLineupSizeComponent(`region,${team.region}`)
        await interaction.reply({ embeds: leaderboardEmbeds, components: [leaderboardPaginationComponent, globalLeaderboardComponent, lineupSizeComponent], ephemeral: true })
    }
};