const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");
const statsService = require("../../services/statsService");
const authorizationService = require("../../services/authorizationService");
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require("discord.js");
const { handle } = require("../../utils");

module.exports = {
    customId: 'challenge_select',
    async execute(interaction) {
        await matchmakingService.challenge(interaction, interaction.values[0])
    }
}