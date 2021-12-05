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
                        value: 'leaderboard_global_value'
                    },
                    {
                        label: '👕 Team Stats',
                        value: 'leaderboard_team_value',
                    },
                ])
        )


        const numberOfPlayers = await statsService.countNumberOfPlayers()
        const numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        const leaderboardEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, numberOfPages)
        const leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent({ globalStats: true, page: 0, lineupSizes: [] }, numberOfPages)
        const lineupSizeComponent = interactionUtils.createLeaderBoardLineupSizeComponent(true)
        await interaction.reply({ embeds: leaderboardEmbeds, components: [leaderboardPaginationComponent, globalLeaderboardComponent, lineupSizeComponent], ephemeral: true })
    }
};