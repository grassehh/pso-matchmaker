import { ButtonInteraction } from "discord.js";
import { IComponentHandler } from "./componentHandler";

export interface IButtonHandler extends IComponentHandler<ButtonInteraction> { }