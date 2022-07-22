import { User } from "discord.js";
import { model, Schema, Types } from "mongoose";
import { notEmpty } from "./utils";

export interface ITeam {
    guildId: string,
    name: string,
    region: string
}
const teamSchema = new Schema<ITeam>({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    region: { type: String, required: true }
})
export const Team = model<ITeam>('Team', teamSchema, 'teams')

export interface IUser {
    id: string,
    name: string,
    mention: string,
    emoji?: string
}
const userSchema = new Schema<IUser>({
    id: { type: String, required: true },
    name: { type: String, required: true },
    mention: { type: String, required: true },
    emoji: { type: String, required: false }
})

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

export interface ILineup {
    isMixOrCaptains(): boolean,
    isMix(): boolean,
    isCaptains(): boolean,
    numberOfSignedPlayers(): number,
    channelId: string,
    size: number,
    roles: IRole[],
    name?: string | '',
    autoSearch: boolean,
    team: ITeam,
    type: string,
    visibility: string,
    isPicking?: boolean | false,
    lastNotificationTime?: Date | null
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
    name: {
        type: String,
        required: false,
        default: ""
    },
    autoSearch: {
        type: Boolean,
        required: true
    },
    team: {
        type: teamSchema,
        required: true
    },
    type: {
        type: String,
        enum: ['TEAM', 'MIX', 'CAPTAINS'],
        required: true
    },
    visibility: {
        type: String,
        enum: ['PUBLIC', 'TEAM'],
        required: true,
        default: 'PUBLIC'
    },
    isPicking: {
        type: Boolean,
        required: false,
        default: false
    },
    lastNotificationTime: {
        type: Date,
        required: false
    }
})
lineupSchema.index({ channelId: 1 });
lineupSchema.index({ "team.region": 1, type: 1, channelId: 1, size: 1 });
lineupSchema.methods.isMix = function () {
    return this.type === 'MIX'
}
lineupSchema.methods.isCaptains = function () {
    return this.type === 'CAPTAINS'
}
lineupSchema.methods.isMixOrCaptains = function () {
    return this.isMix() || this.isCaptains()
}
lineupSchema.methods.numberOfSignedPlayers = function () {
    return this.roles.filter((role: IRole) => role.lineupNumber === 1).filter((role: IRole) => role.user != null).length;
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
    }
})
export const LineupQueue = model<ILineupQueue>('LineupQueue', lineupQueueSchema, 'lineup-queues')

export interface IChallenge {
    _id: Types.ObjectId
    initiatingUser: IUser,
    initiatingTeam: ILineupQueue,
    initiatingMessageId: string,
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

export interface IMatch {
    findUserRole(user: User): IRole | null,
    matchId: string,
    schedule: Date,
    firstLineup: ILineup,
    secondLineup: ILineup | null,
    lobbyName: string,
    lobbyPassword: string,
    subs: ISub[]
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
        required: false
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
    _id: Types.ObjectId,
    userId: string,
    region: string,
    numberOfGames: number,
    numberOfRankedGames: number
}
const statsSchema = new Schema<IStats>({
    userId: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    numberOfGames: {
        type: Number,
        required: true
    },
    numberOfRankedGames: {
        type: Number,
        required: true
    }
})
export const Stats = model<IStats>('Stats', statsSchema, 'stats')
statsSchema.index({ userId: 1, region: 1 });
statsSchema.index({ region: 1 });

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