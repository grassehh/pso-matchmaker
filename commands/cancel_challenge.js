const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const matchmakingService = require("../services/matchmakingService");
const teamService = require("../services/teamService");
const { handle } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cancel_challenge')
        .setDescription('Cancels the current challenge request (if any)'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        let challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
        if (!challenge) {
            await interaction.reply({ content: "❌ Your lineup is not currently challenging", ephemeral: true })
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interactionUtils.replyLineupNotSetup(interaction)
            return
        }

        await matchmakingService.deleteChallengeById(challenge.id)
        await matchmakingService.freeLineupQueuesByIds([challenge.challengedTeam.id, challenge.initiatingTeam.id])

        const [challengedTeamChannel] = await handle(interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId))
        if (challengedTeamChannel) {
            if (!challenge.challengedTeam.lineup.isMix()) {
                await challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] })
            }
            await challengedTeamChannel.send(`❌ ${interaction.user} has cancelled the challenge request against **${teamService.formatTeamName(challenge.initiatingTeam.lineup)}**`)
        }

        const [initiatingTeamChannel] = await handle(interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId))
        if (initiatingTeamChannel) {
            await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
            await initiatingTeamChannel.send(`❌ ${interaction.user} has cancelled the challenge request against **${teamService.formatTeamName(challenge.challengedTeam.lineup)}**`)
        }
        await interaction.reply({ content: 'You have cancelled the challenge request', ephemeral: true })
    }
}