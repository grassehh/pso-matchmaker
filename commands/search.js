const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, replyLineupNotSetup, retrieveLineup, replyTeamNotRegistered } = require('../services');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Put your team in the matchmaking queue'),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }
        let lineup = retrieveLineup(interaction.channelId, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }

        new LineupQueue({
            team: {
                name: team.name,
                region: team.region
            },
            lineup: lineup
        }).save()
        await interaction.reply({ content: `Your team is now queued for ${lineup.size}v${lineup.size}` })
    },
};