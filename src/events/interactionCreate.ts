
import { GuildMember, Interaction } from 'discord.js';
import { commands, componentInteractions } from '../index';
import { authorizationService, interactionUtils, teamService } from '../beans';
import { IEventHandler } from '../handlers/eventHandler';

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        if (!interaction.isCommand() && !interaction.isButton() && !interaction.isSelectMenu()) {
            return
        }

        if (!authorizationService.isBotAllowed(interaction)) {
            await interaction.reply({ content: '⛔ Please add me to this channel before using any command (I need  SEND_MESSAGES and VIEW_CHANNEL permissions)', ephemeral: true })
            return
        }

        const ban = await teamService.findBanByUserIdAndGuildId(interaction.user.id, interaction.guildId!)
        if (ban) {
            await interaction.reply({ content: `⛔ You are ${ban.expireAt ? `banned until ${ban.expireAt.toUTCString()}` : 'permanently banned'}. You cannot use the bot on this server.`, ephemeral: true })
            return
        }


        if (interaction.isCommand()) {
            const command = commands.get(interaction.commandName);

            if (!command) return;

            if (!authorizationService.isAllowedToExecuteCommand(command, interaction.member as GuildMember)) {
                await interactionUtils.replyNotAllowed(interaction)
                return
            }

            try {
                await command.execute(interaction);
                return
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                return
            }
        }

        for (const componentInteraction of componentInteractions) {
            if (interaction.customId.startsWith(componentInteraction.customId)) {
                try {
                    componentInteraction.execute(interaction);
                }
                catch (error) {
                    console.error(error);
                    try {
                        await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
                    } catch (error) {
                        //Shush
                    }
                }
            }
        }
    }
} as IEventHandler
