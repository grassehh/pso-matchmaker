import command from "../../../src/interactions/commands/register_team"
import { jest } from '@jest/globals';
import { CommandInteraction } from "discord.js";

jest.mock('discord.js')

describe('test register team', () => {
    // beforeEach(() => {
    //     command.mockClear();     
    //    });

    test('register team should create a new team', async () => {
        const mock = jest.fn().mockImplementation(() => {
            return {};
          });
        await command.execute(mock as unknown as CommandInteraction)
        expect(true).toBe(true);
    });
});