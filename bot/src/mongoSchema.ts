import { Client, GuildChannel, User } from "discord.js";
import { model, Schema, Types } from "mongoose";
import { DEFAULT_RATING, MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED } from "./constants";
import { MatchResult } from "./services/matchmakingService";
import { Region, regionService } from "./services/regionService";
import { LINEUP_TYPE_CAPTAINS, LINEUP_TYPE_MIX, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM, ROLE_ATTACKER, ROLE_DEFENDER, ROLE_GOAL_KEEPER, ROLE_MIDFIELDER, ROLE_MIX_CAPTAINS, ROLE_NAME_ANY, TeamLogoDisplay, TeamType } from "./services/teamService";
import { notEmpty } from "./utils";

export interface IUser {
    id: string,
    name: string,
    mention: string,
    emoji?: string,
    rating?: number
}
const userSchema = new Schema<IUser>({
    id: { type: String, required: true },
    name: { type: String, required: true },
    mention: { type: String, required: true },
    emoji: { type: String, required: false },
    rating: { type: Number, required: false, default: DEFAULT_RATING }
})

export interface ITeam {
    prettyPrintName(teamLogoDisplay?: TeamLogoDisplay): string,
    getTierRoleId(): string,
    getAvailableTierRoleIds(): string[],
    guildId: string,
    name: string,
    nameUpperCase: string,
    code?: string,
    codeUpperCase?: string,
    logo?: string,
    type: TeamType,
    region: Region,
    lastMatchDate?: Date,
    rating: number,
    verified: boolean,
    captains: IUser[],
    players: IUser[]
}
const teamSchema = new Schema<ITeam>({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    nameUpperCase: { type: String, required: true },
    code: { type: String, required: false },
    codeUpperCase: { type: String, required: false },
    logo: { type: String, required: false },
    type: { type: Number, enum: TeamType, required: true, default: TeamType.CLUB },
    region: { type: String, enum: Region, required: true },
    lastMatchDate: { type: Date, required: false, default: () => new Date() },
    rating: { type: Number, required: true, default: DEFAULT_RATING },
    verified: { type: Boolean, required: true, default: false },
    captains: { type: [userSchema], required: true, default: () => [] },
    players: { type: [userSchema], required: true, default: () => [] }
})
teamSchema.methods.prettyPrintName = function (teamLogoDisplay: TeamLogoDisplay = TeamLogoDisplay.LEFT) {
    let name: string = ''
    if (teamLogoDisplay === TeamLogoDisplay.LEFT) {
        name += `${this.logo ? `${this.logo} ` : ''}`
    }
    name += `**${this.name}**`
    if (teamLogoDisplay === TeamLogoDisplay.RIGHT) {
        name += ` ${this.logo ? `${this.logo}` : ''}`
    }

    return name
}
teamSchema.methods.getTierRoleId = function () {
    return regionService.getTierRoleId(this.region, this.rating)
}
teamSchema.methods.getAvailableTierRoleIds = function () {
    return regionService.getAvailableTierRoleIds(this.region, this.rating)
}
export const Team = model<ITeam>('Team', teamSchema, 'teams')

export interface IRole {
    name: string,
    type: number,
    user?: IUser,
    lineupNumber: number,
    pos: number
}
const roleSchema = new Schema<IRole>({
    name: { type: String, required: true },
    type: { type: Number, required: true },
    user: { type: userSchema, required: false },
    lineupNumber: { type: Number, required: true },
    pos: { type: Number, required: true },
})

export interface IRoleBench {
    user: IUser,
    roles: IRole[]
}
const roleBenchSchema = new Schema<IRoleBench>({
    user: { type: userSchema, required: true },
    roles: { type: [roleSchema], required: true }
})

export interface ILineup {
    isMixOrCaptains(): boolean,
    isMix(): boolean,
    isCaptains(): boolean,
    isTeam(): boolean,
    numberOfSignedPlayers(): number,
    moveAllBenchToLineup(lineupNumber?: number, clearLineup?: boolean): ILineup,
    getNonMercSignedRoles(): IRole[],
    computePlayersAverageRating(lineupNumber?: number): number,
    isAllowedToPlayRanked(): boolean,
    prettyPrintName(teamLogoDisplay?: TeamLogoDisplay, includeRating?: boolean): string,
    getTierRoleId(client: Client): Promise<string>,
    channelId: string,
    size: number,
    roles: IRole[],
    bench: IRoleBench[] | [],
    name?: string | '',
    autoSearch: boolean,
    autoMatchmaking: boolean,
    team: ITeam,
    type: string,
    visibility: string,
    isPicking?: boolean | false,
    allowRanked: boolean,
    lastNotificationTime?: Date | null,
    lastMatchDate?: Date
}
const lineupSchema = new Schema<ILineup>({
    channelId: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    roles: {
        type: [roleSchema],
        required: true
    },
    bench: {
        type: [roleBenchSchema],
        required: true,
        default: []
    },
    name: {
        type: String,
        required: false,
        default: ""
    },
    autoSearch: {
        type: Boolean,
        required: true,
        default: false
    },
    autoMatchmaking: {
        type: Boolean,
        required: true,
        default: false
    },
    team: {
        type: teamSchema,
        required: true
    },
    type: {
        type: String,
        enum: [LINEUP_TYPE_TEAM, LINEUP_TYPE_MIX, LINEUP_TYPE_CAPTAINS],
        required: true
    },
    visibility: {
        type: String,
        enum: [LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM],
        required: true,
        default: LINEUP_VISIBILITY_PUBLIC
    },
    isPicking: {
        type: Boolean,
        required: false,
        default: false
    },
    allowRanked: {
        type: Boolean,
        required: true,
        default: false
    },
    lastNotificationTime: {
        type: Date,
        required: false
    },
    lastMatchDate: {
        type: Date,
        required: false,
        default: () => new Date()
    }
})
lineupSchema.index({ channelId: 1 });
lineupSchema.index({ "team.region": 1, type: 1, channelId: 1, size: 1 });
lineupSchema.methods.isMix = function () {
    return this.type === LINEUP_TYPE_MIX
}
lineupSchema.methods.isCaptains = function () {
    return this.type === LINEUP_TYPE_CAPTAINS
}
lineupSchema.methods.isMixOrCaptains = function () {
    return this.isMix() || this.isCaptains()
}
lineupSchema.methods.isTeam = function () {
    return this.type === LINEUP_TYPE_TEAM
}
lineupSchema.methods.numberOfSignedPlayers = function () {
    return this.roles.filter((role: IRole) => role.lineupNumber === 1).filter((role: IRole) => role.user != null).length;
}
lineupSchema.methods.getNonMercSignedRoles = function () {
    return this.roles.filter((role: IRole) => role.user).filter((role: IRole) => role.user?.id !== MERC_USER_ID)
}
lineupSchema.methods.moveAllBenchToLineup = function (lineupNumber: number = 1, clearLineup: boolean = true) {
    if (clearLineup) {
        this.roles.filter((lineupRole: IRole) => lineupRole.lineupNumber === lineupNumber)
            .forEach((role: IRole) => role.user = undefined)
    }

    const benchedUsers = this.bench.filter((benchedUser: IRoleBench) => benchedUser.roles[0].lineupNumber === lineupNumber)
    if (benchedUsers.length === 0) {
        return this
    }

    const newRoles: IRole[] = [];
    const newBench: IRoleBench[] = []
    benchedUsers.forEach((benchedUser: IRoleBench, i: number, benchedUsers: IRoleBench[]) => {
        let availableBenchRole
        const rolesByIndexInBench = new Map<number, IRole>()
        for (const role of benchedUser.roles) {
            if (role.name === ROLE_NAME_ANY) {
                const availableRole = this.roles.find((lineupRole: IRole) => lineupRole.lineupNumber === lineupNumber && !newRoles.some(r => r.name === lineupRole.name))
                if (availableRole) {
                    role.name = availableRole.name
                    availableBenchRole = role
                }
            } else {
                if (newRoles.some(nr => nr.name === role.name)) {
                    continue
                }
                const index = benchedUsers.slice(i + 1).findIndex(br => br.roles.some(r => r.name === role.name))
                if (index === -1) {
                    availableBenchRole = role
                    break
                }
                rolesByIndexInBench.set(index, role)
            }
        }
        if (!availableBenchRole && rolesByIndexInBench.size > 0) {
            availableBenchRole = rolesByIndexInBench.get(Math.max(...Array.from(rolesByIndexInBench.keys())))
        }
        if (availableBenchRole) {
            newRoles.push(availableBenchRole)
        } else {
            newBench.push(benchedUser)
        }
    })

    this.bench = this.bench.filter((benchUser: IRoleBench) => benchUser.roles[0].lineupNumber !== lineupNumber)
    if (newBench.length > 0) {
        this.bench.push(...newBench)
    }
    newRoles.forEach(role => {
        this.roles.find((lineupRole: IRole) => lineupRole.name === role.name && lineupRole.lineupNumber === lineupNumber)!!.user = role.user
    })

    return this
}
lineupSchema.methods.computePlayersAverageRating = function (lineupNumber: number = 1) {
    const signedRoles = this.getNonMercSignedRoles().filter((role: IRole) => role.lineupNumber === lineupNumber)
    const sum = signedRoles.map((role: IRole) => role.user?.rating).reduce((a: number, b: number) => a + b, 0)
    return this.lineupRatingAverage = (sum / signedRoles.length) || 0
}
lineupSchema.methods.isAllowedToPlayRanked = function () {
    const hasPlayersNotInVerifiedTeam = this.getNonMercSignedRoles().some((role: IRole) => !this.team.players.some((p2: IUser) => role.user?.id === p2.id))
    return this.team.verified
        && this.allowRanked
        && this.getNonMercSignedRoles().length === this.size
        && !hasPlayersNotInVerifiedTeam
        && this.size >= MIN_LINEUP_SIZE_FOR_RANKED
}
lineupSchema.methods.prettyPrintName = function (teamLogoDisplay: TeamLogoDisplay = TeamLogoDisplay.LEFT, includeRating: boolean = false) {
    let name: string = this.team.prettyPrintName(teamLogoDisplay)

    if (this.name) {
        name += ` - *${this.name}*`
    }

    if (includeRating) {
        let rating
        if (this.isMixOrCaptains()) {
            rating = this.computePlayersAverageRating()
        } else {
            rating = this.team.rating
        }
        name += ` *(${rating})*`
    }

    return name
}
lineupSchema.methods.getTierRoleId = async function (client: Client): Promise<string> {
    if (this.isMix()) {
        const channel = await client.channels.fetch(this.channelId) as GuildChannel
        const allTierRoleIds = regionService.getAllTierRoleIds(this.team.region)
        return allTierRoleIds.find(roleId => channel.permissionOverwrites.resolve(roleId) !== null)!
    }

    return this.team.getTierRoleId()
}
export const Lineup = model<ILineup>('Lineup', lineupSchema, 'lineups')

export interface INotificationMessage {
    channelId: string,
    messageId: string
}
const notificationMessageSchema = new Schema<INotificationMessage>({
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
})

export interface ILineupQueue {
    _id: Types.ObjectId,
    lineup: ILineup,
    challengeId: string | null,
    notificationMessages: INotificationMessage[],
    ranked: boolean,
    matchmakingAttempts: number
}
const lineupQueueSchema = new Schema<ILineupQueue>({
    lineup: {
        type: lineupSchema,
        required: true
    },
    challengeId: {
        type: String,
        required: false
    },
    notificationMessages: {
        type: [notificationMessageSchema],
        required: false
    },
    ranked: {
        type: Boolean,
        required: true,
        default: false
    },
    matchmakingAttempts: {
        type: Number,
        required: true,
        default: 0
    }
})
export const LineupQueue = model<ILineupQueue>('LineupQueue', lineupQueueSchema, 'lineup-queues')

export interface IChallenge {
    _id: Types.ObjectId
    initiatingUser: IUser,
    initiatingTeam: ILineupQueue,
    initiatingMessageId?: string,
    challengedTeam: ILineupQueue,
    challengedMessageId: string
}
const challengeSchema = new Schema<IChallenge>({
    initiatingUser: {
        type: userSchema,
        required: true
    },
    initiatingTeam: {
        type: lineupQueueSchema,
        required: true
    },
    initiatingMessageId: {
        type: String,
        required: true
    },
    challengedTeam: {
        type: lineupQueueSchema,
        required: true
    },
    challengedMessageId: {
        type: String,
        required: true
    }
})
export const Challenge = model<IChallenge>('Challenge', challengeSchema, 'challenges')

export interface ISub {
    user: IUser
}
const subSchema = new Schema<ISub>({
    user: {
        type: userSchema,
        required: true
    }
})

export interface ILineupMatchResult {
    captainUserId: string,
    result: MatchResult
}
const lineupMatchResultSchema = new Schema<ILineupMatchResult>({
    captainUserId: {
        type: String,
        required: true
    },
    result: {
        type: Number,
        enum: MatchResult,
        required: true
    }
})

export interface IMatchResult {
    firstLineup?: ILineupMatchResult,
    secondLineup?: ILineupMatchResult,
}
const matchResultSchema = new Schema<IMatchResult>({
    firstLineup: {
        type: lineupMatchResultSchema,
        required: false
    },
    secondLineup: {
        type: lineupMatchResultSchema,
        required: false
    }
})

export interface IMatch {
    findUserRole(user: User): IRole | null,
    matchId: string,
    schedule: Date,
    firstLineup: ILineup,
    secondLineup: ILineup,
    lobbyName: string,
    lobbyPassword: string,
    subs: ISub[],
    ranked: boolean,
    result: IMatchResult
}
const matchSchema = new Schema<IMatch>({
    matchId: {
        type: String,
        required: true
    },
    schedule: {
        type: Date,
        required: true
    },
    firstLineup: {
        type: lineupSchema,
        required: true
    },
    secondLineup: {
        type: lineupSchema,
        required: true
    },
    lobbyName: {
        type: String,
        required: true
    },
    lobbyPassword: {
        type: String,
        required: true
    },
    subs: {
        type: [subSchema],
        required: true
    },
    ranked: {
        type: Boolean,
        required: true,
        default: false
    },
    result: {
        type: matchResultSchema,
        required: true,
        default: {}
    }
})
matchSchema.index({ schedule: 1 }, { expireAfterSeconds: 4 * 60 * 60 });
matchSchema.methods.findUserRole = function (user: User): IRole | null {
    const existingUserInSubs = this.subs.filter((role: IRole) => role.user).find((role: IRole) => role.user?.id === user.id)
    let existingUserInFirstLineup
    let existingUserInSecondLineup
    if (this.secondLineup) {
        existingUserInFirstLineup = this.firstLineup.roles.filter((role: IRole) => role.lineupNumber === 1).filter((role: IRole) => role.user).find((role: IRole) => role.user?.id === user.id)
        existingUserInSecondLineup = this.secondLineup.roles.filter((role: IRole) => role.lineupNumber === 1).filter((role: IRole) => role.user).find((role: IRole) => role.user?.id === user.id)
    } else {
        existingUserInFirstLineup = this.firstLineup.roles.filter((role: IRole) => role.user).find((role: IRole) => role.user?.id === user.id)
    }
    return [existingUserInSubs, existingUserInFirstLineup, existingUserInSecondLineup].find(notEmpty)
}
export const Match = model<IMatch>('Match', matchSchema, 'matches')

export interface IStats {
    getRoleRating(roleType: number): number,
    setRoleRating(roleType: number, rating: number): number,
    getAverageRating(): number,
    _id: Types.ObjectId,
    userId: string,
    region: Region,
    numberOfGames: number,
    numberOfRankedGames: number,
    numberOfRankedWins: number,
    numberOfRankedDraws: number,
    numberOfRankedLosses: number,
    attackRating: number,
    midfieldRating: number,
    defenseRating: number,
    goalKeeperRating: number,
    mixCaptainsRating: number
}
const statsSchema = new Schema<IStats>({
    userId: {
        type: String,
        required: true
    },
    region: {
        type: String,
        enum: Region,
        required: true
    },
    numberOfGames: {
        type: Number,
        required: true,
        default: 0
    },
    numberOfRankedGames: {
        type: Number,
        required: true,
        default: 0
    },
    numberOfRankedWins: {
        type: Number,
        required: true,
        default: 0
    },
    numberOfRankedDraws: {
        type: Number,
        required: true,
        default: 0
    },
    numberOfRankedLosses: {
        type: Number,
        required: true,
        default: 0
    },
    attackRating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    },
    defenseRating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    },
    midfieldRating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    },
    goalKeeperRating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    },
    mixCaptainsRating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    }
})
statsSchema.index({ userId: 1, region: 1 });
statsSchema.index({ region: 1 });
statsSchema.methods.getRoleRating = function (roleType: number): number {
    switch (roleType) {
        case ROLE_ATTACKER:
            return this.attackRating
        case ROLE_DEFENDER:
            return this.defenseRating
        case ROLE_MIDFIELDER:
            return this.midfieldRating
        case ROLE_GOAL_KEEPER:
            return this.goalKeeperRating
        case ROLE_MIX_CAPTAINS:
            return this.mixCaptainsRating
        default:
            return 0
    }
}
statsSchema.methods.setRoleRating = function (roleType: number, rating: number) {
    switch (roleType) {
        case ROLE_ATTACKER:
            this.attackRating = rating
            break
        case ROLE_DEFENDER:
            this.defenseRating = rating
            break
        case ROLE_MIDFIELDER:
            this.midfieldRating = rating
            break
        case ROLE_GOAL_KEEPER:
            this.goalKeeperRating = rating
            break
        case ROLE_MIX_CAPTAINS:
            this.mixCaptainsRating = rating
            break
        default:
            break
    }
}
statsSchema.methods.getAverageRating = function (): number {
    return (this.attackRating + this.defenseRating + this.midfieldRating + this.goalKeeperRating) / 4
}
export const Stats = model<IStats>('Stats', statsSchema, 'stats')

export interface IBan {
    userId: string,
    guildId: string,
    reason: string,
    expireAt: Date | null
}
const bansSchema = new Schema<IBan>({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: false
    },
    expireAt: {
        type: Date,
        required: false
    }
})
bansSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
bansSchema.index({ userId: 1, guildId: 1 });
export const Bans = model<IBan>('Bans', bansSchema, 'bans')