
import { ChannelManager, Client, Message, TextChannel, User, UserManager } from 'discord.js';
import { anyString, anything, instance, mock, when } from 'ts-mockito';
import { ILineupQueue, IUser, LineupQueue } from '../../src/mongoSchema';
import { matchmakingService } from '../../src/services/matchmakingService';
import { ROLE_GOAL_KEEPER } from '../../src/services/teamService';
import { buildLineup, buildLineupQueue, dbClean, dbConnect, dbDisconnect } from '../test.utils';

beforeAll(async () => await dbConnect())
afterAll(async () => await dbDisconnect())
afterEach(async () => await dbClean())

jest.setTimeout(15000)

describe('testing matchmakingService', () => {
    it('should make casual match when both teams have GK', async () => {
        //Given
        const client = mock(Client)
        const userManager = mock(UserManager)
        const user = jest.mocked(User)
        user.prototype.id = 'userId'
        user.prototype.username = 'userName'
        user.prototype.toString = jest.fn(() => '<@user>')
        user.prototype.send = jest.fn(() => new Promise((resolve) => resolve(instance(mock(Message)))))
        when(userManager.fetch(anyString())).thenResolve(user.prototype)
        when(client.users).thenReturn(instance(userManager))
        const channel = mock(TextChannel)
        when(channel.send(anything())).thenResolve(instance(mock(Message)))
        const channelManager = mock(ChannelManager)
        when(channelManager.fetch(anyString())).thenResolve(instance(channel))
        when(client.channels).thenReturn(instance(channelManager))

        const lineup1 = buildLineup()
        lineup1.channelId = '1111'
        lineup1.roles.forEach((role, i) => role.user = { id: `userId_1111_${i}`, name: 'userName', mention: '@userName' } as IUser)
        await lineup1.save()
        const lineupQueue1 = buildLineupQueue()
        lineupQueue1.lineup = lineup1
        await lineupQueue1.save()

        const lineup2 = buildLineup()
        lineup2.channelId = '2222'
        lineup2.roles.forEach((role, i) => role.user = { id: `userId_2222_${i}`, name: 'userName', mention: '@userName' } as IUser)
        await lineup2.save()
        const lineupQueue2 = buildLineupQueue()
        lineupQueue2.lineup = lineup2
        await lineupQueue2.save()

        const lineup3 = buildLineup()
        lineup3.channelId = '3333'
        lineup3.roles.filter(role => role.type !== ROLE_GOAL_KEEPER).forEach((role, i) => role.user = { id: `userId_3333_${i}`, name: 'userName', mention: '@userName' } as IUser)
        await lineup3.save()
        const lineupQueue3 = buildLineupQueue()
        lineupQueue3.lineup = lineup3
        await lineupQueue3.save()

        //When
        await matchmakingService.makeMatches(instance(client))

        //Then    
        const lineupQueues = await LineupQueue.find() as ILineupQueue[]
        expect(lineupQueues.length).toBe(1)
    })
})