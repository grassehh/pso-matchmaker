import { ButtonInteraction, EmbedBuilder, InteractionReplyOptions, User } from 'discord.js';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';

import button from "../../../src/interactions/buttons/role";
import { LINEUP_TYPE_MIX, ROLE_ATTACKER } from '../../../src/services/teamService';
import { buildLineup, buildTeam, dbClean, dbConnect, dbDisconnect, setupFakeDate, tearDownFakedDate } from "../../test.utils";

beforeAll(async () => {
    await dbConnect()
    setupFakeDate()
});
afterAll(async () => await dbDisconnect());
afterEach(async () => {
    await dbClean()
    tearDownFakedDate()
})

describe('testing roles button', () => {
    describe('testing readying match', () => {
        it('should ready match when both casual mix lineups are full', async () => {
            //Given
            // await buildUser().save()
            await buildTeam().save()
            const lineup = buildLineup()
            lineup.type = LINEUP_TYPE_MIX
            lineup.size = 1
            lineup.roles = [
                { name: 'CF', type: ROLE_ATTACKER, lineupNumber: 1, pos: 0 },
                { name: 'CF', type: ROLE_ATTACKER, lineupNumber: 2, pos: 0 }
            ]
            await lineup.save()
            const interaction = mock(ButtonInteraction)
            when(interaction.customId).thenReturn('role_CF_1')
            const user = mock(User)
            when(user.id).thenReturn('userId')
            when(interaction.user).thenReturn(instance(user))

            //When
            await button.execute(instance(interaction))

            //Then    
            verify(interaction.reply(anything())).once()
            const replyOptions = capture(interaction.reply).first()[0] as InteractionReplyOptions;
            expect((replyOptions.embeds![0] as EmbedBuilder).data.description).toBe("✅ New lineup configured")
        })
    })
})