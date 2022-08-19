
import { APIEmbed, ChatInputCommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, InteractionReplyOptions } from 'discord.js';
import { capture, instance, mock, verify, when, anything } from 'ts-mockito';

import command from "../../../src/interactions/commands/team_create";
import { ITeam, Team } from '../../../src/mongoSchema';
import { Region } from '../../../src/services/regionService';
import { dbClean, dbConnect, dbDisconnect } from "../../test.utils";

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
afterEach(async () => dbClean())

describe('testing /team_create command', () => {
  it('should create a new team', async () => {
    //Given
    const commandOptions = mock(CommandInteractionOptionResolver)
    when(commandOptions.getString('team_name')).thenReturn('PSO Matchmaker Test')
    when(commandOptions.getString('team_region')).thenReturn('EU')
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1234')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.embeds).toBeTruthy()
    expect(replyOptions.embeds?.length).toEqual(1)
    expect((replyOptions.embeds![0] as EmbedBuilder).data.description).toBe("✅ Your team has been registered !")
    verify(interaction.followUp(anything())).once()

    const team = await Team.findOne() as ITeam
    expect(team.name).toBe('PSO Matchmaker Test');
    expect(team.region).toBe(Region.EUROPE);
  })

  it('should not create team when already exists', async () => {
    //Given
    await new Team({ guildId: '1234', name: 'PMT', nameUpperCase: 'PMT', region: Region.EUROPE } as ITeam).save()
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.guildId).thenReturn('1234')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ You team is already registered as 'PMT'. Use the /team_name command if you wish to change the name of your team.")
    expect(replyOptions.ephemeral).toBe(true)
    const count = await Team.count()
    expect(count).toBe(1);
  })
})