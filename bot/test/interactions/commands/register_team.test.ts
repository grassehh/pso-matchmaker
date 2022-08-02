
import command from '../../../src/interactions/commands/register_team';
import { ChatInputCommandInteraction } from "discord.js";

const mockedInteraction = jest.mocked(ChatInputCommandInteraction)
describe('testing /register_team command', () => {
    it('should register a new team', async () => {
        await command.execute(mockedInteraction.prototype)
    });
});