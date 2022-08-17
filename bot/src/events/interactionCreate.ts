
import { GuildMember, Interaction } from 'discord.js';
import { commands, componentInteractions } from '../index';
import { IEventHandler } from '../handlers/eventHandler';
import { authorizationService } from '../services/authorizationService';
import { teamService } from '../services/teamService';
import { interactionUtils } from '../services/interactionUtils';
import { handle } from '../utils';

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isSelectMenu()) {
            return
        }

        if (!(await authorizationService.isSteamAccountLinked(interaction.user))) {
            await interaction.reply({ content: `⛔ You need to log into your **Steam account** in order to interact with the bot by **[clicking here](${process.env.PSO_MM_STEAM_LOGIN_URL}?discordUserId=${interaction.user.id})**`, ephemeral: true })
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


        try {
            if (interaction.isChatInputCommand()) {
                const command = commands.get(interaction.commandName);

                if (!command) return;

                if (!authorizationService.isAllowedToExecuteCommand(command, interaction.member as GuildMember)) {
                    await interactionUtils.replyNotAllowed(interaction)
                    return
                }

                await command.execute(interaction);
                return
            }

            if (interaction.isButton() || interaction.isSelectMenu()) {
                for (const componentInteraction of componentInteractions) {
                    if (interaction.customId.startsWith(componentInteraction.customId)) {
                        componentInteraction.execute(interaction);
                    }
                }
            }
        } catch (error) {
            console.error(error);
            await handle(interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }))
        }
    }
} as IEventHandler
