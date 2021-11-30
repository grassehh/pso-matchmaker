const { SlashCommandBuilder } = require('@discordjs/builders');
const { retrieveTeam, createLineupComponents, replyTeamNotRegistered, retrieveLineup, replyLineupNotSetup } = require('../services');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lineup')
        .setDescription('Displays the current lineup'),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            await replyTeamNotRegistered(interaction)
            return
        }
        let lineup = retrieveLineup(interaction, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }

        await interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) });
    },
};