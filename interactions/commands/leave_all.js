const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const { handle } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave_all')
        .setDescription('Remove you from every lineup you are signed in'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        const lineups = await teamService.findAllLineupsByUserId(interaction.user.id)
        if (lineups.length === 0) {
            await interaction.reply({ content: `You are not signed in any lineup`, ephemeral: true })
            return
        }

        await Promise.all(lineups.map(async lineup => {
            const [channel] = await handle(interaction.client.channels.fetch(lineup.channelId))
            if (!channel) {
                return
            }

            await teamService.leaveLineup(interaction, channel, lineup)
        }))

        await interaction.reply({ content: `You have been removed from all lineups`, ephemeral: true })
    }
}