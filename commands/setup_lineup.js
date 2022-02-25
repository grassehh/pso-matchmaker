const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");
const matchmakingService = require("../services/matchmakingService");
const constants = require("../constants");

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
            )
            .addBooleanOption(option => option.setName('auto_search')
                .setRequired(false)
                .setDescription('Indicates if this lineup should automatically search for a team once it is filled')),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId)
        if (lineupQueue) {
            await interactionUtils.replyAlreadyQueued(interaction, lineupQueue.lineup.size)
            return
        }

        const lineupSize = interaction.options.getInteger("size")
        const autoSearch = interaction.options.getBoolean("auto_search")
        let lineup = teamService.createLineup(interaction.channelId, lineupSize, null, autoSearch, team, teamService.LINEUP_TYPE_TEAM, teamService.LINEUP_VISIBILITY_PUBLIC)
        await teamService.upsertLineup(lineup)

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.content = `✅ New lineup configured`
        await interaction.reply(reply);
    }
};