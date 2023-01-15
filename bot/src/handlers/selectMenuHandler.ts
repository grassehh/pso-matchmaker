import { AnySelectMenuInteraction } from "discord.js";
import { IComponentHandler } from "./componentHandler";

export interface ISelectMenuHandler extends IComponentHandler<AnySelectMenuInteraction> {}