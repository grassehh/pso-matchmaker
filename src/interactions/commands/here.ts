import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageOptions } from "discord.js";
import { interactionUtils, teamService } from "../../beans";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('here')
        .setDescription('Notify every player in the channel'),
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const now = new Date()
        if (lineup.lastNotificationTime && now.getTime() < lineup.lastNotificationTime.getTime() + 10 * 60 * 1000) {
            const timeBeforeNextNotification = Math.ceil(((lineup.lastNotificationTime.getTime() + 10 * 60 * 1000) - now.getTime()) / 1000 / 60)
            await interaction.reply({ content: `Please wait ${timeBeforeNextNotification} minute(s) before notifying again`, ephemeral: true })
            return
        }

        const reply = await interactionUtils.createReplyForLineup(interaction, lineup) as MessageOptions
        reply.content = "Wake up @everyone ! It's time to sign !"

        await teamService.updateLastNotificationTime(interaction.channelId, now)
        await interaction.channel?.send(reply)
        await interaction.reply({ content: 'You notified everyone', ephemeral: true })
    }
} as ICommandHandler