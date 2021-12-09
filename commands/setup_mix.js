const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");
const matchmakingService = require("../services/matchmakingService");
const constants = require("../constants");
const { LineupQueue } = require('../mongoSchema');

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix')
            .setDescription('Setup a mix lineup (allows mix vs mix matches)')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of each mix lineups')
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
            .addStringOption(option => option.setName('name')
                .setRequired(false)
                .setDescription('Sets a name for this lineup. Useful if you have multiple lineups inside your team'))
            .addStringOption(option => option.setName('visibility')
                .setRequired(false)
                .setDescription('If you set the visibility to public, you mix will be visible in the whole region')
                .addChoice('Team', teamService.LINEUP_VISIBILITY_TEAM)
                .addChoice('Public', teamService.LINEUP_VISIBILITY_PUBLIC)
            ),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        let lineupName = interaction.options.getString("name")
        if (!teamService.validateLineupName(lineupName)) {
            await interaction.reply({
                content: `❌ Please choose a name with less than ${constants.MAX_LINEUP_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        const lineupSize = interaction.options.getInteger("size")
        const visibility = interaction.options.getString("visibility")
        let lineup = teamService.createLineup(interaction.channelId, lineupSize, lineupName, true, team, true, visibility ? visibility : teamService.LINEUP_VISIBILITY_TEAM)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)
        const lineupQueue = await new LineupQueue({ lineup }).save()

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.content = `✅ New lineup configured`
        await interaction.reply(reply);
    }
};