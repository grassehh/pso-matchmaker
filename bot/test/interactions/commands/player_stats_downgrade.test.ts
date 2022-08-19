
import { ChatInputCommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, InteractionReplyOptions, User } from 'discord.js';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';

import command from "../../../src/interactions/commands/player_stats_downgrade";
import { IStats, Stats } from '../../../src/mongoSchema';
import { ROLE_MIDFIELDER } from '../../../src/services/teamService';
import { buildStats, buildTeam, dbClean, dbConnect, dbDisconnect, setupFakeDate, tearDownFakedDate } from "../../test.utils";

beforeAll(async () => {
  await dbConnect()
  setupFakeDate()
});
afterAll(async () => await dbDisconnect());
afterEach(async () => {
  await dbClean()
  tearDownFakedDate()
})

describe('testing /player_stats_downgrade command', () => {
  it('should downgrade player rating', async () => {
    //Given
    await buildStats().save()
    const team = buildTeam()
    await team.save()
    const commandOptions = mock(CommandInteractionOptionResolver)
    const user = mock(User)
    when(user.id).thenReturn('userId')
    when(commandOptions.getUser('player')).thenReturn(instance(user))
    when(commandOptions.getString('position')).thenReturn(ROLE_MIDFIELDER.toString())
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1010115986441125929')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect((replyOptions.embeds![0] as EmbedBuilder).data.description).toBe("✅ User rating has been downgraded by 5 (new average rating 998.75)")
    const stats = await Stats.findOne() as IStats
    expect(stats.attackRating).toBe(1000)
    expect(stats.midfieldRating).toBe(995)
    expect(stats.defenseRating).toBe(1000)
    expect(stats.goalKeeperRating).toBe(1000)
  })

  it('should not downgrade player rating when not on official discord', async () => {
    //Given
    await buildStats().save()
    await buildTeam().save()
    const commandOptions = mock(CommandInteractionOptionResolver)
    const user = mock(User)
    when(user.id).thenReturn('userId')
    when(commandOptions.getUser('player')).thenReturn(instance(user))
    when(commandOptions.getString('position')).thenReturn(ROLE_MIDFIELDER.toString())
    const interaction = mock(ChatInputCommandInteraction)
    when(interaction.options).thenReturn(instance(commandOptions))
    when(interaction.guildId).thenReturn('1234')

    //When
    await command.execute(instance(interaction))

    //Then    
    verify(interaction.reply(anything())).once()
    const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
    expect(replyOptions.content).toBe("⛔ Only official discords can use this command")
    expect(replyOptions.ephemeral).toBe(true)
    const stats = await Stats.findOne() as IStats
    expect(stats.attackRating).toBe(1000)
    expect(stats.midfieldRating).toBe(1000)
    expect(stats.defenseRating).toBe(1000)
    expect(stats.goalKeeperRating).toBe(1000)
  })
})