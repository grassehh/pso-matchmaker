const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");
const matchmakingService = require("../services/matchmakingService");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix_captains')
            .setDescription('Setup a mix lineup with captains picking')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The number of players in each team')
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
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const lineupSize = interaction.options.getInteger("size")
        let lineup = teamService.createLineup(interaction.channelId, lineupSize, '', true, team, teamService.LINEUP_TYPE_CAPTAINS, teamService.LINEUP_VISIBILITY_TEAM)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup)
        reply.content = `✅ New lineup configured`
        await interaction.reply(reply);
    }
};