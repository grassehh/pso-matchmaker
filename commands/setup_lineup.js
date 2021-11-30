const { SlashCommandBuilder } = require('@discordjs/builders');
const { Lineup, PlayerRole } = require('../mongoSchema');
const { retrieveTeam, replyTeamNotRegistered, retrieveLineup, createLineupComponents } = require('../services');

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_lineup')
            .setDescription('Set the size of the team lineup to use for the selected channel')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of the team lineup')
                .addChoice('1', 1)
                .addChoice('2', 2)
                .addChoice('3', 3)
                .addChoice('4', 4)
                .addChoice('5', 5)
                .addChoice('6', 6)
                .addChoice('7', 7)
                .addChoice('8', 8)
                .addChoice('9', 9)
                .addChoice('10', 10)
                .addChoice('11', 11)
            ),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            replyTeamNotRegistered(interaction)
            return
        }
        let lineup = retrieveLineup(interaction.channelId, team)
        if (lineup == null) {
            lineup = new Lineup(
                {
                    channelId: interaction.channelId,
                    size: interaction.options.getInteger("size"),
                    roles: [
                        new PlayerRole({ name: "LW" }),
                        new PlayerRole({ name: "RW" })
                    ]
                }
            )
            team.lineups.push(lineup)
        } else {
            lineup.size = interaction.options.getInteger("size")
        }
        team.save()
        await interaction.reply({ content: `New lineup has now a size of ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) });
    },
};