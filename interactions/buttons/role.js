const interactionUtils = require("../../services/interactionUtils");
const matchmakingService = require("../../services/matchmakingService");
const teamService = require("../../services/teamService");
const statsService = require("../../services/statsService");
const { handle } = require("../../utils");

module.exports = {
    customId: 'role_',
    async execute(interaction) {
        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const split = interaction.customId.split('_')
        const selectedRoleName = split[1]
        const lineupNumber = parseInt(split[2])
        const selectedRole = lineup.roles.filter(role => role.lineupNumber === lineupNumber).find(role => role.name == selectedRoleName)
        const roleLeft = lineup.roles.find(role => role.user?.id === interaction.user.id)

        if (selectedRole.user) {
            await interaction.reply({ content: 'A player is already signed at this position', ephemeral: true })
            return
        }

        let description = `:inbox_tray: ${interaction.user} signed as **${selectedRoleName}**`
        if (roleLeft) {
            await teamService.removeUserFromLineup(interaction.channelId, interaction.user.id, lineupNumber)
            await matchmakingService.removeUserFromLineupQueue(interaction.channelId, interaction.user.id)
            description = `:outbox_tray::inbox_tray: ${interaction.user} swapped **${roleLeft.name}** with **${selectedRoleName}**`
        }

        let userToAdd = {
            id: interaction.user.id,
            name: interaction.user.username,
            emoji: statsService.getLevelEmojiFromMember(interaction.member)
        }
        lineup = await teamService.addUserToLineup(interaction.channelId, selectedRoleName, userToAdd, lineupNumber)
        await matchmakingService.addUserToLineupQueue(interaction.channelId, selectedRoleName, userToAdd, lineupNumber)

        if (await matchmakingService.isMixOrCaptainsReadyToStart(lineup)) {
            const embed = interactionUtils.createInformationEmbed(interaction.user, description)
            await interaction.channel.send({ embeds: [embed] })
            const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
            const secondLineup = challenge ? await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId === interaction.channelId ? challenge.challengedTeam.lineup.channelId : challenge.initiatingTeam.lineup.channelId) : null
            const duplicatedUsersReply = await matchmakingService.checkForDuplicatedPlayers(interaction, lineup, secondLineup)
            if (duplicatedUsersReply) {
                await interaction.reply(duplicatedUsersReply)
                return
            }

            await matchmakingService.readyMatch(interaction, challenge, lineup)
            await interaction.reply({ content: "You have readied the match", ephemeral: true })
            return
        }

        const autoSearchResult = await matchmakingService.checkIfAutoSearch(interaction.client, interaction.user, lineup)
        if (autoSearchResult.joinedQueue) {
            description += `\nYour lineup is full, it is now searching for a **${lineup.size}v${lineup.size}** team !`
        }
        if (autoSearchResult.leftQueue) {
            description += `\nYou are no longer searching for a team.`
        }
        if (autoSearchResult.cancelledChallenge) {
            description += `\nThe challenge request has been cancelled.`
        }

        await handle(interaction.update({ components: [] }))
        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, autoSearchResult.updatedLineupQueue)
        const informationEmbed = interactionUtils.createInformationEmbed(interaction.user, description)
        reply.embeds = (reply.embeds || []).concat(informationEmbed)
        await interaction.channel.send(reply)
    }
}