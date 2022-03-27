const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageSelectMenu, MessageActionRow } = require('discord.js');
const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('request_sub')
        .setDescription(`Send a sub request for a given match`)
        .addStringOption(option => option.setName('match_id')
            .setRequired(true)
            .setDescription('The id of the match you want to request a sub for')),
    async execute(interaction) {
        const matchId = interaction.options.getString('match_id')

        const match = await matchmakingService.findMatchByMatchId(matchId)
        if (!match) {
            await interactionUtils.replyMatchDoesntExist(interaction)
            return
        }

        if (!match.findUserRole(interaction.user)) {
            await interaction.reply({ content: '⛔ You must be playing this match in order to request a sub', ephemeral: true })
            return
        }

        const subSelectActionRow = new MessageActionRow()
        const subRoleSelectMenu = new MessageSelectMenu()
            .setCustomId(`subRequest_select_${match.matchId}`)
            .setPlaceholder('Which position do you need a sub for ?')

        const roles = match.firstLineup.roles.filter(role => role.lineupNumber === 1)
        for (let role of roles) {
            subRoleSelectMenu.addOptions([{ label: role.name, value: role.name }])
        }

        subSelectActionRow.addComponents(subRoleSelectMenu)

        await interaction.reply({ components: [subSelectActionRow], ephemeral: true })
    }
};