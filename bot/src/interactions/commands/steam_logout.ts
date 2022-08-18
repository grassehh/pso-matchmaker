import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { userService } from "../../services/userService";

export default {
    data: new SlashCommandBuilder()
        .setName('steam_logout')
        .setDescription('Unlink your steam account from the bot'),
    async execute(interaction: ChatInputCommandInteraction) {
        await userService.logout(interaction.user.id)
        await interaction.reply({
            embeds: [
                interactionUtils.createInformationEmbed('✅ Your Steam account has been successfully unlinked')
            ], ephemeral: true
        })
    }
} as ICommandHandler