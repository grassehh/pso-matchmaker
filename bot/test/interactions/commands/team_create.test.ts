
import command from '../../../src/interactions/commands/team_create';
import { ChatInputCommandInteraction } from "discord.js";

const mockedInteraction = jest.mocked(ChatInputCommandInteraction)
describe('testing /team_create command', () => {
    it('should register a new team', async () => {
        await command.execute(mockedInteraction.prototype)
    });
});