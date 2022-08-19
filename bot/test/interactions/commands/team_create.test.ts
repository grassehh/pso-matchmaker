
import { ChatInputCommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, InteractionReplyOptions } from 'discord.js';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';

import command from "../../../src/interactions/commands/team_create";
import { ITeam, Team } from '../../../src/mongoSchema';
import { Region } from '../../../src/services/regionService';
import { TeamType } from '../../../src/services/teamService';
import { dbClean, dbConnect, dbDisconnect, fakeNowDate, setupFakeDate, buildTeam as buildTeam, tearDownFakedDate } from "../../test.utils";

beforeAll(async () => {
  await dbConnect()
  setupFakeDate()
});
afterAll(async () => await dbDisconnect());
afterEach(async () => {
  await dbClean()
  tearDownFakedDate()
})

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
    expect((replyOptions.embeds![0] as EmbedBuilder).data.description).toBe("✅ Your team has been registered !")
    verify(interaction.followUp(anything())).once()
    const team = await Team.findOne() as ITeam
    expect(team.guildId).toBe('1234');
    expect(team.name).toBe('PSO Matchmaker Test');
    expect(team.nameUpperCase).toBe('PSO MATCHMAKER TEST');
    expect(team.code).toBeUndefined()
    expect(team.logo).toBeUndefined()
    expect(team.type).toBe(TeamType.CLUB)
    expect(team.region).toBe(Region.EUROPE);
    expect(team.lastMatchDate?.getTime()).toBe(fakeNowDate)
    expect(team.rating).toBe(1000)
    expect(team.verified).toBe(false)
    expect(team.captains.length).toBe(0)
    expect(team.players.length).toBe(0)
  })

  it('should not create team when already exists', async () => {
    //Given
    await buildTeam().save()
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

  it('should not create another team when already exists with the same name', async () => {
    //Given
    await buildTeam().save()
    const commandOptions = mock(CommandInteractionOptionResolver)
    when(commandOptions.getString('team_name')).thenReturn('PMT')
    when(commandOptions.getString('team_region')).thenReturn('EU')
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('4567')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Another team is already registered under the name **'PMT'**. Please chose another name.")
    expect(replyOptions.ephemeral).toBe(true)
    const count = await Team.count()
    expect(count).toBe(1);
  })

  it('should not create team when the name is empty', async () => {
    //Given
    const commandOptions = mock(CommandInteractionOptionResolver)
    when(commandOptions.getString('team_name')).thenReturn('')
    when(commandOptions.getString('team_region')).thenReturn('EU')
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1234')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Please choose a name with less than 30 characters.")
    expect(replyOptions.ephemeral).toBe(true)
    const team = await Team.findOne() as ITeam
    expect(team).toBeNull()
  })

  it('should not create team when the name is too long', async () => {
    //Given
    const commandOptions = mock(CommandInteractionOptionResolver)
    when(commandOptions.getString('team_name')).thenReturn('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAs')
    when(commandOptions.getString('team_region')).thenReturn('EU')
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1234')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Please choose a name with less than 30 characters.")
    expect(replyOptions.ephemeral).toBe(true)
    const team = await Team.findOne() as ITeam
    expect(team).toBeNull()
  })
})