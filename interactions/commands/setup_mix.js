const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const matchmakingService = require("../../services/matchmakingService");
const constants = require("../../constants");
const { LineupQueue } = require('../../mongoSchema');

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix')
            .setDescription('Setup a mix lineup (allows mix vs mix matches)')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of each mix lineups')
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '2', value: 2 },
                    { name: '3', value: 3 },
                    { name: '4', value: 4 },
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                    { name: '8', value: 8 },
                    { name: '9', value: 9 },
                    { name: '10', value: 10 },
                    { name: '11', value: 11 }
                )
            )
            .addStringOption(option => option.setName('name')
                .setRequired(false)
                .setDescription('Sets a name for this mix. Useful if you have multiple mixes inside your team'))
            .addStringOption(option => option.setName('visibility')
                .setRequired(false)
                .setDescription('If you set the visibility to public, you mix will be visible in the whole region')
                .addChoices(
                    { name: 'Team', value: teamService.LINEUP_VISIBILITY_TEAM },
                    { name: 'Public', value: teamService.LINEUP_VISIBILITY_PUBLIC }
                )
            ),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineupName = interaction.options.getString("name")
        if (!teamService.validateLineupName(lineupName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${constants.MAX_LINEUP_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        const lineupSize = interaction.options.getInteger("size")
        const visibility = interaction.options.getString("visibility")
        let lineup = teamService.createLineup(interaction.channelId, lineupSize, lineupName, true, team, teamService.LINEUP_TYPE_MIX, visibility ? visibility : teamService.LINEUP_VISIBILITY_TEAM)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)
        const lineupQueue = await new LineupQueue({ lineup }).save()

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.content = `✅ New lineup configured`
        await interaction.reply(reply);
    }
};