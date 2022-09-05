import { Client, GuildChannel, User as DiscordUser } from "discord.js";
import { model, Schema, Types } from "mongoose";
import { DEFAULT_RATING, MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED } from "./constants";
import { MatchResult } from "./services/matchmakingService";
import { Region, regionService } from "./services/regionService";
import { LINEUP_TYPE_CAPTAINS, LINEUP_TYPE_MIX, LINEUP_TYPE_SOLO, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM, ROLE_NAME_ANY, TeamLogoDisplay, TeamType } from "./services/teamService";
import { notEmpty } from "./utils";

export interface IUser {
    isMerc(): boolean,
    id: string,
    steamId?: string,
    name: string,
    mention: string,
    emoji?: string,
    rating: number
}
const userSchema = new Schema<IUser>({
    id: { type: String, required: true },
    steamId: { type: String, required: false },
    name: { type: String, required: true },
    mention: { type: String, required: true },
    emoji: { type: String, required: false },
    rating: { type: Number, required: true, default: DEFAULT_RATING }
})
userSchema.index({ id: 1 });
userSchema.index({ steamId: 1 });
userSchema.methods.isMerc = function (): boolean {
    return this.id === MERC_USER_ID
}
export const User = model<IUser>('User', userSchema, 'users')

export interface ITeam {
    prettyPrintName(teamLogoDisplay?: TeamLogoDisplay): string,
    getTierRoleId(): string | undefined,
    getAvailableTierRoleIds(): string[],
    hasPlayerOrCaptain(userId: string): boolean,
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
    type: { type: Number, enum: TeamType, required: true, default: () => TeamType.CLUB },
    region: { type: String, enum: Region, required: true },
    lastMatchDate: { type: Date, required: false, default: () => Date.now() },
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
teamSchema.methods.hasPlayerOrCaptain = function (userId: string) {
    return this.players.some((player: IUser) => player.id === userId) || this.captains.some((captain: IUser) => captain.id === userId)
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
    isNotTeam(): boolean,
    isSoloQueue(): boolean,
    isMix(): boolean,
    isCaptains(): boolean,
    isTeam(): boolean,
    numberOfSignedPlayers(): number,
    moveAllBenchToLineup(lineupNumber?: number, clearLineup?: boolean): ILineup,
    getNonMercSignedRoles(lineupNumber?: number): IRole[],
    getMercSignedRoles(lineupNumber?: number): IRole[],
    computePlayersAverageRating(lineupNumber?: number): number,
    isAllowedToPlayRanked(): boolean,
    prettyPrintName(teamLogoDisplay?: TeamLogoDisplay, includeRating?: boolean): string,
    getTierRoleId(client: Client): Promise<string>,
    isAnonymous(): boolean,
    hasSignedRole(roleName: string): boolean,
    distributeRolesForSoloQueue(): void,
    channelId: string,
    size: number,
    roles: IRole[],
    bench: IRoleBench[],
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
        enum: [LINEUP_TYPE_TEAM, LINEUP_TYPE_MIX, LINEUP_TYPE_CAPTAINS, LINEUP_TYPE_SOLO],
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
        default: () => Date.now()
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
lineupSchema.methods.isSoloQueue = function () {
    return this.type === LINEUP_TYPE_SOLO
}
lineupSchema.methods.isNotTeam = function () {
    return !this.isTeam()
}
lineupSchema.methods.isTeam = function () {
    return this.type === LINEUP_TYPE_TEAM
}
lineupSchema.methods.numberOfSignedPlayers = function () {
    return this.roles.filter((role: IRole) => role.lineupNumber === 1).filter((role: IRole) => role.user != null).length;
}
lineupSchema.methods.getNonMercSignedRoles = function (lineupNumber?: number) {
    let roles
    if (lineupNumber) {
        roles = this.roles.filter((role: IRole) => role.lineupNumber === lineupNumber)
    } else {
        roles = this.roles
    }
    return roles.filter((role: IRole) => role.user).filter((role: IRole) => !role.user?.isMerc())
}
lineupSchema.methods.getMercSignedRoles = function (lineupNumber?: number) {
    let roles
    if (lineupNumber) {
        roles = this.roles.filter((role: IRole) => role.lineupNumber === lineupNumber)
    } else {
        roles = this.roles
    }
    return roles.filter((role: IRole) => role.user).filter((role: IRole) => role.user?.isMerc())
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
        if (this.isNotTeam()) {
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
lineupSchema.methods.isAnonymous = function (): boolean {
    return this.isSoloQueue() && this.allowRanked
}
lineupSchema.methods.hasSignedRole = function (roleName: string): boolean {
    return this.roles.filter((role: IRole) => role.user).some((role: IRole) => role.name === roleName)
}
lineupSchema.methods.distributeRolesForSoloQueue = function (): void {
    const newRoles: IRole[] = []
    this.roles.sort((a: IRole, b: IRole) => b.user!.rating - a.user!.rating)
    this.roles.forEach((role: IRole, i: number) => {
        if (!newRoles.some(r => r.name === role.name)) {
            const lineup1Roles = newRoles.filter(role => role.lineupNumber === 1)
            const lineup2Roles = newRoles.filter(role => role.lineupNumber === 2)
            const lineup1RatingAverage = lineup1Roles.map(r => r.user!.rating).reduce((a, b) => a + b, 0) / lineup1Roles.length;
            const lineup2RatingAverage = lineup2Roles.map(r => r.user!.rating).reduce((a, b) => a + b, 0) / lineup2Roles.length;
            const [lineupNumber, oppositeLineupNumber] = lineup1RatingAverage > lineup2RatingAverage ? [2, 1] : [1, 2]
            role.lineupNumber = lineupNumber
            const oppositeRole = this.roles.slice(i + 1).find((r: IRole) => r.name === role.name)!
            newRoles.push(role)
            oppositeRole.lineupNumber = oppositeLineupNumber
            newRoles.push(oppositeRole)
        }
    })
    this.roles = newRoles
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
    result?: MatchResult
}
const lineupMatchResultSchema = new Schema<ILineupMatchResult>({
    captainUserId: {
        type: String,
        required: true
    },
    result: {
        type: Number,
        enum: MatchResult,
        required: false
    }
})

export interface IMatchResult {
    isVoted(): boolean,
    isCancelled(): boolean,
    firstLineup: ILineupMatchResult,
    secondLineup: ILineupMatchResult,
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
matchResultSchema.methods.isVoted = function (): boolean {
    return this.firstLineup.result != null && this.secondLineup.result != null
}
matchResultSchema.methods.isCancelled = function (): boolean {
    return this.firstLineup.result === MatchResult.CANCEL && this.secondLineup.result === MatchResult.CANCEL
}

export interface IMatch {
    findUserRole(user: DiscordUser): IRole | null,
    matchId: string,
    schedule: Date,
    firstLineup: ILineup,
    secondLineup: ILineup,
    lobbyName: string,
    lobbyPassword: string,
    subs: ISub[],
    ranked: boolean,
    result?: IMatchResult
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
        required: false
    }
})
matchSchema.index({ schedule: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
matchSchema.methods.findUserRole = function (user: DiscordUser): IRole | null {
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

interface IStats {
    _id: Types.ObjectId,
    region: Region,
    numberOfRankedWins: number,
    numberOfRankedDraws: number,
    numberOfRankedLosses: number,
    totalNumberOfRankedWins: number,
    totalNumberOfRankedDraws: number,
    totalNumberOfRankedLosses: number,
    rating: number,
}

export interface IPlayerStats extends IStats {
    userId: string,
    numberOfRankedGames: number,
    mixCaptainsRating: number
}
const playerStatsSchema = new Schema<IPlayerStats>({
    userId: {
        type: String,
        required: true
    },
    region: {
        type: String,
        enum: Region,
        required: true
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
    totalNumberOfRankedWins: {
        type: Number,
        required: true,
        default: 0
    },
    totalNumberOfRankedDraws: {
        type: Number,
        required: true,
        default: 0
    },
    totalNumberOfRankedLosses: {
        type: Number,
        required: true,
        default: 0
    },
    rating: {
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
playerStatsSchema.index({ userId: 1, region: 1 });
playerStatsSchema.index({ region: 1 });
export const PlayerStats = model<IPlayerStats>('PlayerStats', playerStatsSchema, 'player-stats')

export interface ITeamStats extends IStats {
    guildId: string
}
const teamStatsSchema = new Schema<ITeamStats>({
    guildId: {
        type: String,
        required: true
    },
    region: {
        type: String,
        enum: Region,
        required: true
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
    totalNumberOfRankedWins: {
        type: Number,
        required: true,
        default: 0
    },
    totalNumberOfRankedDraws: {
        type: Number,
        required: true,
        default: 0
    },
    totalNumberOfRankedLosses: {
        type: Number,
        required: true,
        default: 0
    },
    rating: {
        type: Number,
        required: true,
        default: DEFAULT_RATING
    },
})
teamStatsSchema.index({ guildId: 1 });
export const TeamStats = model<ITeamStats>('TeamStats', teamStatsSchema, 'team-stats')

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