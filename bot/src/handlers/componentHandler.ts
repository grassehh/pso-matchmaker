import { MessageComponentInteraction } from "discord.js";

export interface IComponentHandler<T extends MessageComponentInteraction> {
    customId: string,
    execute(interaction: T): Promise<void>
}