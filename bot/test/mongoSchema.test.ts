import { IUser } from "../src/mongoSchema"
import { ROLE_ATTACKER, ROLE_GOAL_KEEPER, ROLE_MIDFIELDER } from "../src/services/teamService"
import { buildLineup, dbClean, dbConnect, dbDisconnect } from "./test.utils"


beforeAll(async () => await dbConnect())
afterAll(async () => await dbDisconnect())
afterEach(async () => await dbClean())

describe('testing ILineup model', () => {
    it('should compute roles for solo queue', () => {
        //Given
        const lineup = buildLineup()
        lineup.size = 3
        lineup.roles = [
            {
                name: "CF",
                type: ROLE_ATTACKER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 800 } as IUser,
                lineupNumber: 1,
                pos: 0
            },
            {
                name: "CM",
                type: ROLE_MIDFIELDER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 1200 } as IUser,
                lineupNumber: 1,
                pos: 0
            },
            {
                name: "GK",
                type: ROLE_GOAL_KEEPER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 1000 } as IUser,
                lineupNumber: 1,
                pos: 0
            },
            {
                name: "CF",
                type: ROLE_ATTACKER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 800 } as IUser,
                lineupNumber: 2,
                pos: 0
            },
            {
                name: "CM",
                type: ROLE_MIDFIELDER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 1000 } as IUser,
                lineupNumber: 2,
                pos: 0
            },
            {
                name: "GK",
                type: ROLE_GOAL_KEEPER,
                user: { id: 'userId', name: 'user', mention: '@user', rating: 900 } as IUser,
                lineupNumber: 2,
                pos: 0
            }
        ]

        //When
        lineup.distributeRolesForSoloQueue()

        //Then
        const firstLineupRoles = lineup.roles.filter(role => role.lineupNumber === 1)
        expect(firstLineupRoles.find(role => role.name === "CF")?.user?.rating).toBe(800)
        expect(firstLineupRoles.find(role => role.name === "CM")?.user?.rating).toBe(1200)
        expect(firstLineupRoles.find(role => role.name === "GK")?.user?.rating).toBe(900)

        const secondLineupRoles = lineup.roles.filter(role => role.lineupNumber === 2)
        expect(secondLineupRoles.find(role => role.name === "CF")?.user?.rating).toBe(800)
        expect(secondLineupRoles.find(role => role.name === "CM")?.user?.rating).toBe(1000)
        expect(secondLineupRoles.find(role => role.name === "GK")?.user?.rating).toBe(1000)
    })
})