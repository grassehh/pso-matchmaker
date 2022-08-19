
import { ChatInputCommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, InteractionReplyOptions } from 'discord.js';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';

import command from "../../../src/interactions/commands/lineup_create";
import { ILineup, Lineup } from '../../../src/mongoSchema';
import { buildLineup, buildLineupQueue, buildTeam, dbClean, dbConnect, dbDisconnect, fakeNowDate, setupFakeDate, tearDownFakedDate } from "../../test.utils";

beforeAll(async () => {
  await dbConnect()
  setupFakeDate()
});
afterAll(async () => await dbDisconnect());
afterEach(async () => {
  await dbClean()
  tearDownFakedDate()
})

describe('testing /lineup_create command', () => {
  it('should create a new lineup', async () => {
    //Given
    await buildTeam().save()
    const commandOptions = mock(CommandInteractionOptionResolver)
    when(commandOptions.getInteger('size')).thenReturn(8)
    when(commandOptions.getBoolean('auto_search')).thenReturn(true)
    when(commandOptions.getBoolean('auto_matchmaking')).thenReturn(true)
    when(commandOptions.getBoolean('allow_ranked')).thenReturn(true)
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1234')
    when(interaction.channelId).thenReturn('4567')
    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect((replyOptions.embeds![0] as EmbedBuilder).data.description).toBe("✅ New lineup configured")
    const lineup = await Lineup.findOne() as ILineup
    expect(lineup.channelId).toBe('4567')
    expect(lineup.roles.length).toBe(8)
    expect(lineup.bench.length).toBe(0)
    expect(lineup.name).toBe('')
    expect(lineup.autoSearch).toBe(true)
    expect(lineup.autoMatchmaking).toBe(true)
    expect(lineup.team.guildId).toBe('1234')
    expect(lineup.type).toBe("TEAM")
    expect(lineup.visibility).toBe("PUBLIC")
    expect(lineup.isPicking).toBe(false)
    expect(lineup.allowRanked).toBe(true)
    expect(lineup.lastNotificationTime).toBeUndefined()
    expect(lineup.lastMatchDate?.getTime()).toBe(fakeNowDate)
  })

  it('should not create a new lineup when the team does not exist', async () => {
    //Given
    const interaction = mock(ChatInputCommandInteraction)

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Please register your team with the /team_create command first")
    expect(replyOptions.ephemeral).toBe(true)
  })

  it('should not create a new lineup when a lineupqueue exists', async () => {
    //Given
    await buildTeam().save()
    await buildLineup().save()
    await buildLineupQueue().save()
    const interaction = mock(ChatInputCommandInteraction)

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Please register your team with the /team_create command first")
    expect(replyOptions.ephemeral).toBe(true)
  })
})