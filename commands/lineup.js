const { SlashCommandBuilder } = require('@discordjs/builders');
const { retrieveTeam, replyTeamNotRegistered, retrieveLineup, replyLineupNotSetup, createLineupReply } = require('../services');

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
        let lineup = retrieveLineup(interaction.channelId, team)
        if (!lineup) {
            await replyLineupNotSetup(interaction)
            return
        }  

        await interaction.reply(createLineupReply(lineup, interaction.user.id))
    },
};