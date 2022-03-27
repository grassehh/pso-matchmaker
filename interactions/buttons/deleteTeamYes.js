const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'delete_team_yes_',
    async execute(interaction) {
        await matchmakingService.deleteChallengesByGuildId(interaction.guildId)
        await matchmakingService.deleteLineupQueuesByGuildId(interaction.guildId)
        await teamService.deleteLineupsByGuildId(interaction.guildId)
        await teamService.deleteBansByGuildId(interaction.guildId)
        await teamService.deleteTeam(interaction.guildId)
        await interaction.reply({ content: '✅ Your team has been deleted', ephemeral: true })
    }
}