import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

export interface ICommandHandler {
    data: SlashCommandBuilder,
    authorizedRoles?: string[],
    execute(interaction: CommandInteraction): Promise<void>
}