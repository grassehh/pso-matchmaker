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
        let team = await teamService.findTeamByGuildId(interaction.guildId)

        if (!team) {
            interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const globalLeaderboardComponent = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId(`leaderboard_global_select`)
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
                ]),
        )

        let numberOfPlayers = await statsService.countNumberOfPlayers()
        let numberOfPages = Math.ceil(numberOfPlayers / statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let leaderboardEmbeds = await interactionUtils.createLeaderBoardEmbeds(interaction, null, 0, numberOfPages, statsService.DEFAULT_LEADERBOARD_PAGE_SIZE)
        let leaderboardPaginationComponent = interactionUtils.createLeaderBoardPaginationComponent(true, 0, numberOfPages)
        interaction.reply({ embeds: leaderboardEmbeds, components: [leaderboardPaginationComponent, globalLeaderboardComponent], ephemeral: true })
    }
};