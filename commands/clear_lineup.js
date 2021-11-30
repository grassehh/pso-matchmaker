const { SlashCommandBuilder } = require('@discordjs/builders');
const { retrieveTeam, createLineupComponents, replyTeamNotRegistered, replyLineupNotSetup, retrieveLineup } = require('../services');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear_lineup')
        .setDescription('Clears every roles in this lineup'),
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

        lineup.roles.forEach(role => {
            role.user = null
        });
        team.save()
        await interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) });
    },
};