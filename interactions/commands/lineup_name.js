const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");
const authorizationService = require("../../services/authorizationService");
const constants = require("../../constants");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lineup_name')
        .setDescription('Let you edit the name of the lineup')
        .addStringOption(option => option.setName('name')
            .setDescription('The new name of the lineup (leave it empty to remove the name)')
        ),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }
        
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }
        
        const newName = interaction.options.getString("name")
        if (!teamService.validateLineupName(newName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${constants.MAX_LINEUP_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        await teamService.updateLineupNameByChannelId(interaction.channelId, newName)
        await interaction.reply(`✅ Your new lineup name is **${newName ? newName : "*empty*"}**`)
    },
};