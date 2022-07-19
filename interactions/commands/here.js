const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../../services/interactionUtils");
const teamService = require("../../services/teamService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('here')
        .setDescription('Notify every player in the channel'),
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const now = Date.now()
        if (lineup.lastNotificationTime && now < lineup.lastNotificationTime.getTime() + 10 * 60 * 1000) {
            const timeBeforeNextNotification = Math.ceil(((lineup.lastNotificationTime.getTime() + 10 * 60 * 1000) - now) / 1000 / 60)
            await interaction.reply({ content: `Please wait ${timeBeforeNextNotification} minute(s) before notifying again`, ephemeral: true })
            return
        }

        const reply = await interactionUtils.createReplyForLineup(interaction, lineup)
        reply.content = "Wake up @everyone ! It's time to sign !"

        await teamService.updateLastNotificationTime(interaction.channelId, now)
        await interaction.channel.send(reply)
        await interaction.reply({ content: 'You notified everyone', ephemeral: true })
    }
}