import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";

export interface ICommandHandler {
    data: SlashCommandBuilder,
    authorizedRoles?: string[],
    execute(interaction: ChatInputCommandInteraction): Promise<void>
}