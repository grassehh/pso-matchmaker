import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Bans, Challenge, Lineup, LineupQueue, Match, Stats, Team, User } from "../src/mongoSchema";
import { Region } from "../src/services/regionService";
import { DEFAULT_PLAYER_ROLES, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC, ROLE_ATTACKER } from "../src/services/teamService";

let mongod: MongoMemoryServer

export const dbConnect = async () => {
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

export const dbDisconnect = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
};

export const dbClean = async () => {
    await Team.deleteMany({})
    await Lineup.deleteMany({})
    await LineupQueue.deleteMany({})
    await Challenge.deleteMany({})
    await User.deleteMany({})
    await Stats.deleteMany({})
    await Match.deleteMany({})
    await Bans.deleteMany({})
};

export const buildStats = () => new Stats({ userId: 'userId', region: Region.EUROPE })

export const buildUser = () => new User({ id: 'userId' })

export const buildTeam = () => new Team({ guildId: '1234', name: 'PMT', nameUpperCase: 'PMT', region: Region.EUROPE })
export const buildLineup = () => {
    const defaultRoles = DEFAULT_PLAYER_ROLES.get(8)!
    const roles = defaultRoles.map(obj => ({ ...obj, lineupNumber: 1 }))
    return new Lineup({
        channelId: '2222',
        size: 8,
        roles,
        bench: [],
        autoMatchmaking: true,
        autoSearch: true,
        allowRanked: true,
        team: buildTeam(),
        type: LINEUP_TYPE_TEAM,
        visibility: LINEUP_VISIBILITY_PUBLIC
    })
}

export const buildLineupQueue = () => new LineupQueue({ lineup: buildLineup() })

export const fakeNowDate = 1530518207007
const realDateNow = Date.now.bind(global.Date);
export const setupFakeDate = () => {
    const dateNowStub = jest.fn(() => fakeNowDate);
    global.Date.now = dateNowStub;
}

export const tearDownFakedDate = () => {
    global.Date.now = realDateNow;
}
