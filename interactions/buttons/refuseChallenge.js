const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");

module.exports = {
    customId: 'accept_challenge_',
    async execute(interaction) {
        let challengeId = interaction.customId.substring(17);
        let challenge = await matchmakingService.findChallengeById(challengeId)
        if (!challenge) {
            await interaction.reply({ content: "⛔ This challenge no longer exists", ephemeral: true })
            return
        }
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!matchmakingService.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
            await interaction.reply({ content: `⛔ You must be in the lineup in order to accept a challenge`, ephemeral: true })
            return
        }

        if (challenge.initiatingUser.id === interaction.user.id) {
            await interaction.reply({ content: "⛔ You cannot accept your own challenge request", ephemeral: true })
            return
        }

        const secondLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId)
        if (await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)) {
            return
        }
        await interaction.deferReply()
        await matchmakingService.readyMatch(interaction, challenge)
    }
}