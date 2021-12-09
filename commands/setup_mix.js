const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");
const constants = require("../constants");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix')
            .setDescription('Configures a mix vs mix lineup')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of each lineup in the mix')
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
                .setDescription('Sets a name for this lineup. Useful if you have multiple lineups inside your team')),
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

        let lineupSize = interaction.options.getInteger("size")
        let lineup = teamService.createLineup(interaction.channelId, lineupSize, lineupName, true, team, true)
        await teamService.upsertLineup(lineup)
        await interaction.reply({ content: `✅ New mix lineup has now a size`, components: interactionUtils.createLineupComponents(lineup) });
    }
};