import { BaseGuildTextChannel, Client, EmbedBuilder, Guild, GuildMember, MessageOptions, TextChannel, User } from "discord.js";
import { DeleteResult } from "mongodb";
import { UpdateWriteOpResult } from "mongoose";
import { MAX_LINEUP_NAME_LENGTH, MAX_TEAM_CODE_LENGTH, MAX_TEAM_NAME_LENGTH } from "../constants";
import { Bans, IBan, ILineup, IRole, IRoleBench, IStats, ITeam, IUser, Lineup, LineupQueue, Team } from "../mongoSchema";
import { getEmojis, handle } from "../utils";
import { interactionUtils } from "./interactionUtils";
import { matchmakingService } from "./matchmakingService";
import { Region, regionService } from "./regionService";
import { statsService } from "./statsService";
import { userService } from "./userService";

export enum TeamLogoDisplay {
    NONE = -1,
    LEFT = 0,
    RIGHT = 1
}

export enum TeamType {
    CLUB = 0,
    NATION = 1
}

export namespace TeamTypeHelper {
    export function toString(teamType: TeamType) {
        switch (teamType) {
            case TeamType.CLUB:
                return "Club"
            case TeamType.NATION:
                return "Nation"
        }
    }
}

export const ROLE_GOAL_KEEPER = 0
export const ROLE_ATTACKER = 1
export const ROLE_DEFENDER = 2
export const ROLE_MIDFIELDER = 3
export const ROLE_MIX_CAPTAINS = 4

export const ROLE_NAME_ANY = "any"

export const LINEUP_VISIBILITY_TEAM = 'TEAM'
export const LINEUP_VISIBILITY_PUBLIC = 'PUBLIC'

export const LINEUP_TYPE_TEAM = 'TEAM'
export const LINEUP_TYPE_MIX = 'MIX'
export const LINEUP_TYPE_CAPTAINS = 'CAPTAINS'
export const LINEUP_TYPE_SOLO = 'SOLO'

export const GK = { name: '🥅 GK', type: ROLE_GOAL_KEEPER }
const LW = { name: 'LW', type: ROLE_ATTACKER }
const CF = { name: 'CF', type: ROLE_ATTACKER }
const RW = { name: 'RW', type: ROLE_ATTACKER }
const LM = { name: 'LM', type: ROLE_MIDFIELDER }
const LCM = { name: 'LCM', type: ROLE_MIDFIELDER }
const CM = { name: 'CM', type: ROLE_MIDFIELDER }
const RCM = { name: 'RCM', type: ROLE_MIDFIELDER }
const RM = { name: 'RM', type: ROLE_MIDFIELDER }
const LB = { name: 'LB', type: ROLE_DEFENDER }
const LCB = { name: 'LCB', type: ROLE_DEFENDER }
const CB = { name: 'CB', type: ROLE_DEFENDER }
const RCB = { name: 'RCB', type: ROLE_DEFENDER }
const RB = { name: 'RB', type: ROLE_DEFENDER }

function role(role: any, pos: number) {
    return { ...role, pos }
}

export const DEFAULT_PLAYER_ROLES = new Map([
    [1, [role(CF, 0)]],
    [2, [role(CF, 0), role(GK, 0)]],
    [3, [role(LM, 0), role(RM, 2), role(GK, 1)]],
    [4, [role(CF, 1), role(LB, 0), role(RB, 2), role(GK, 1)]],
    [5, [role(CF, 1), role(LB, 0), role(CB, 1), role(RB, 2), role(GK, 1)]],
    [6, [role(LW, 0), role(RW, 2), role(CM, 1), role(LB, 0), role(RB, 2), role(GK, 1)]],
    [7, [role(LW, 0), role(RW, 2), role(CM, 1), role(LB, 0), role(CB, 1), role(RB, 2), role(GK, 1)]],
    [8, [role(LW, 0), role(CF, 1), role(RW, 2), role(CM, 1), role(LB, 0), role(CB, 1), role(RB, 2), role(GK, 1)]],
    [9, [role(LW, 0), role(CF, 2), role(RW, 4), role(LCM, 1), role(RCM, 3), role(LB, 0), role(CB, 2), role(RB, 4), role(GK, 2)]],
    [10, [role(LW, 0), role(CF, 2), role(RW, 4), role(LCM, 1), role(RCM, 3), role(LB, 0), role(LCB, 1), role(RCB, 3), role(RB, 4), role(GK, 2)]],
    [11, [role(LW, 0), role(CF, 2), role(RW, 4), role(LM, 0), role(CM, 2), role(RM, 4), role(LB, 0), role(LCB, 1), role(RCB, 3), role(RB, 4), role(GK, 2)]]
])

class TeamService {
    validateTeamName(name: string): string | null {
        const filteredName = this.removeSpecialCharacters(name)
        if (filteredName.length === 0 || filteredName.length > MAX_TEAM_NAME_LENGTH) {
            return null
        }

        if (getEmojis(filteredName).length !== 0) {
            return null
        }

        return filteredName
    }

    validateTeamCode(code: string): string | null {
        const filteredName = this.removeSpecialCharacters(code)
        if (filteredName.length === 0 || filteredName.length > MAX_TEAM_CODE_LENGTH) {
            return null
        }

        if (getEmojis(filteredName).length !== 0) {
            return null
        }

        return filteredName
    }

    validateLineupName(name: string): boolean {
        return name.length > 0 && name.length <= MAX_LINEUP_NAME_LENGTH
    }

    hasGkSigned(lineup: ILineup): boolean {
        return lineup.roles.find(role => role.name.includes('GK'))?.user != null;
    }

    async deleteTeam(guildId: string): Promise<void> {
        Promise.all([
            matchmakingService.deleteChallengesByGuildId(guildId),
            matchmakingService.deleteLineupQueuesByGuildId(guildId),
            this.deleteLineupsByGuildId(guildId),
            this.deleteBansByGuildId(guildId),
            Team.deleteOne({ guildId })
        ])
    }

    async findTeamByGuildId(guildId: string): Promise<ITeam | null> {
        return Team.findOne({ guildId })
    }

    async findTeamByRegionAndName(region: Region, name: string): Promise<ITeam | null> {
        return Team.findOne({ region, nameUpperCase: name.toUpperCase() })
    }

    async findTeamByRegionAndCode(region: Region, code: string): Promise<ITeam | null> {
        return Team.findOne({ region, codeUpperCase: code.toUpperCase() })
    }

    async updateTeamLastMatchDateByGuildId(guildId: string, date: Date): Promise<UpdateWriteOpResult> {
        return Team.updateOne({ guildId }, { lastMatchDate: date })
    }

    async updateTeamRating(guildId: string, rating: number): Promise<void> {
        await Promise.all([
            Team.updateOne({ guildId }, { rating }),
            Lineup.updateMany({ 'team.guildId': guildId }, { 'team.rating': rating }),
            LineupQueue.updateMany({ 'lineup.team.guildId': guildId }, { 'lineup.team.rating': rating })
        ])
    }

    async updateLineupNameByChannelId(channelId: string, name?: string): Promise<void> {
        await Promise.all([
            LineupQueue.updateOne({ 'lineup.channelId': channelId }, { 'lineup.name': name }),
            Lineup.updateOne({ channelId }, { name })
        ])
    }

    async updateTeamRegionByGuildId(guildId: string, region: Region): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.region': region, verified: false })
        return Team.findOneAndUpdate({ guildId }, { region, verified: false }, { new: true })
    }

    async deleteLineup(channelId: string): Promise<DeleteResult> {
        return Lineup.deleteOne({ channelId })
    }

    async retrieveLineup(channelId: string): Promise<ILineup | null> {
        return Lineup.findOne({ channelId })
    }

    async upsertLineup(lineup: ILineup): Promise<UpdateWriteOpResult> {
        return Lineup.updateOne(
            { 'channelId': lineup.channelId },
            {
                size: lineup.size,
                roles: lineup.roles,
                bench: lineup.bench,
                name: lineup.name,
                autoMatchmaking: lineup.autoMatchmaking,
                autoSearch: lineup.autoSearch,
                allowRanked: lineup.allowRanked,
                team: lineup.team,
                type: lineup.type,
                visibility: lineup.visibility,
                lastMatchDate: lineup.lastMatchDate
            } as ILineup,
            { upsert: true }
        )
    }

    async clearLineup(channelId: string, lineupsToClear = [1], clearBench: boolean = true): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$set": clearBench ?
                    {
                        "roles.$[i].user": null,
                        "bench": []
                    } :
                    {
                        "roles.$[i].user": null
                    }
            },
            {
                arrayFilters: [{ "i.lineupNumber": { $in: lineupsToClear } }],
                new: true
            }
        )
    }

    async startPicking(channelId: string): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate({ channelId }, { isPicking: true }, { new: true })
    }

    async stopPicking(channelId: string): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate({ channelId }, { isPicking: false }, { new: true })
    }

    async deleteLineupsByGuildId(guildId: string): Promise<DeleteResult> {
        return Lineup.deleteMany({ 'team.guildId': guildId })
    }

    async removeUserFromLineupsByChannelIds(userId: string, channelIds: string[]): Promise<UpdateWriteOpResult> {
        return Lineup.updateMany(
            {
                'channelId': { $in: channelIds }
            },
            {
                "$set": {
                    "roles.$[i].user": null
                },
                "$pull": {
                    "bench": {
                        "user.id": userId
                    }
                }
            },
            {
                arrayFilters: [{ "i.user.id": userId }],
                new: true
            }
        )
    }

    async removeUserFromLineup(channelId: string, userId: string): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$set": {
                    "roles.$[i].user": null
                },
                "$pull": {
                    "bench": {
                        "user.id": userId
                    }
                }
            },
            {
                arrayFilters: [{ "i.user.id": userId }],
                new: true
            }
        )
    }

    async removeUserFromLineupBench(channelId: string, userId: string): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            { channelId },
            {
                "$pull": {
                    "bench": {
                        "user.id": userId
                    }
                }
            },
            {
                new: true
            }
        )
    }

    async moveUserFromBenchToLineup(channelId: string, user: IUser, role: IRole): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$set": {
                    "roles.$[i].user": user
                },
                "$pull": {
                    "bench": {
                        "user.id": user.id
                    }
                }
            },
            {
                arrayFilters: [{ "i.lineupNumber": role.lineupNumber, "i.name": role.name }],
                new: true
            }
        )
    }

    async addUserToLineup(channelId: string, roleName: string, user: IUser, selectedLineup = 1): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$set": {
                    "roles.$[i].user": user
                }
            },
            {
                arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
                new: true
            }
        )
    }

    async addUserToLineupBench(channelId: string, user: IUser, roles: IRole[]): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$push": {
                    "bench": { user, roles } as IRoleBench
                }
            },
            {
                new: true
            }
        )
    }

    async clearRoleFromLineup(channelId: string, roleName: string, selectedLineup = 1): Promise<ILineup | null> {
        return Lineup.findOneAndUpdate(
            {
                channelId
            },
            {
                "$set": {
                    "roles.$[i].user": null
                }
            },
            {
                arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
                new: true
            }
        )
    }

    async joinBench(user: User, lineup: ILineup, rolesNames: string[], member?: GuildMember): Promise<ILineup | null> {
        await this.removeUserFromLineupBench(lineup.channelId, user.id)

        const userToAdd = await userService.findUserByDiscordUserId(user.id) as IUser
        userToAdd.emoji = statsService.getLevelEmojiFromMember(member as GuildMember)
        const benchRoles = rolesNames.map(rn => {
            const split = rn.split('_')
            const roleName = split[0]
            const lineupNumber = parseInt(split[1]) || 1
            return {
                name: roleName,
                type: 0,
                lineupNumber,
                pos: 0,
                user: userToAdd
            } as IRole
        })
        return this.addUserToLineupBench(
            lineup.channelId,
            userToAdd,
            benchRoles
        )
    }

    async leaveLineup(client: Client, user: User, channel: BaseGuildTextChannel, lineup: ILineup): Promise<boolean> {
        let roleLeft = lineup.roles.find(role => role.user?.id === user.id)
        let benchLeft = lineup.bench.find(role => role.user.id === user.id)

        if (!roleLeft && !benchLeft) {
            return false
        }

        let newLineup = await this.removeUserFromLineup(lineup.channelId, user.id) as ILineup
        await matchmakingService.removeUserFromLineupQueue(lineup.channelId, user.id)

        let description
        if (benchLeft) {
            if (lineup.isAnonymous()) {
                description = ':outbox_tray: A player left the bench'
            } else {
                description = `:outbox_tray: ${user} left the bench`
            }
        } else {
            if (lineup.isAnonymous()) {
                description = ':outbox_tray: A player left the queue'
            } else {
                description = `:outbox_tray: ${user} left the ${newLineup.isNotTeam() ? 'queue' : `**${roleLeft?.name}** position`}`
            }
        }

        const autoSearchResult = await matchmakingService.checkIfAutoSearch(client, user, newLineup)
        if (autoSearchResult.leftQueue) {
            description += `\nYou are no longer searching for a team.`
        }
        if (autoSearchResult.cancelledChallenge) {
            description += `\nThe challenge request has been cancelled.`
        }

        const benchUserToTransfer = this.getBenchUserToTransfer(newLineup, roleLeft)
        if (benchUserToTransfer !== null) {
            newLineup = await this.moveUserFromBenchToLineup(channel.id, benchUserToTransfer, roleLeft!!) as ILineup
            if (lineup.isAnonymous()) {
                description += '\n:inbox_tray: A player came off the bench and joined the queue'
            } else {
                description += `\n:inbox_tray: ${benchUserToTransfer.mention} came off the bench and joined the **${roleLeft?.name}** position.`
            }
        }

        let reply = await interactionUtils.createReplyForLineup(newLineup, autoSearchResult.updatedLineupQueue) as MessageOptions
        const embed = interactionUtils.createInformationEmbed(description, lineup.isAnonymous() ? undefined : user)
        reply.embeds = (reply.embeds || []).concat(embed)
        await channel.send(reply)
        return true
    }

    async notifyChannelForUserLeaving(client: Client, user: User, channelId: string, description: string): Promise<void> {
        const [channel] = await handle(client.channels.fetch(channelId))
        if (channel instanceof TextChannel) {
            const lineup = await this.retrieveLineup(channelId)
            if (lineup === null) {
                return
            }

            if (!await this.leaveLineup(client, user, channel, lineup)) {
                return
            }

            const autoSearchResult = await matchmakingService.checkIfAutoSearch(client, user, lineup)
            if (autoSearchResult.leftQueue) {
                description += `\nYou are no longer searching for a team.`
            }
            if (autoSearchResult.cancelledChallenge) {
                description += `\nThe challenge request has been cancelled.`
            }

            const embed = interactionUtils.createInformationEmbed(description, user)
            await channel.send({ embeds: [embed] })
        }
    }

    async findAllLineupChannelIdsByUserId(userId: string, excludedChannelIds: string[] = [], guildId?: string): Promise<string[]> {
        let match: any = {}
        if (guildId) {
            match['team.guildId'] = guildId
        }
        if (excludedChannelIds.length > 0) {
            match.channelId = { $nin: excludedChannelIds }
        }
        match.$or = [
            {
                roles: {
                    $elemMatch: { 'user.id': userId }
                }
            },
            {
                bench: {
                    $elemMatch: { 'user.id': userId }
                }
            }
        ]
        let res = await Lineup.aggregate([
            {
                $match: match
            },
            {
                $group: {
                    _id: null,
                    channelIds: {
                        $addToSet: '$$ROOT.channelId'
                    }
                }
            }
        ])

        if (res.length > 0) {
            return res[0].channelIds
        }

        return []
    }

    async findAllLineupsByUserId(userId: string): Promise<ILineup[]> {
        return Lineup.find(
            {
                $or: [
                    {
                        roles: {
                            $elemMatch: { 'user.id': userId }
                        }
                    },
                    {
                        bench: {
                            $elemMatch: { 'user.id': userId }
                        }
                    }
                ]
            }
        )
    }

    async findChannelIdsByGuildId(guildId: string): Promise<string[]> {
        const res = await Lineup.aggregate([
            {
                $match: {
                    'team.guildId': guildId
                }
            },
            {
                $group: {
                    _id: null,
                    channelIds: {
                        $addToSet: '$$ROOT.channelId'
                    }
                }
            }
        ])

        if (res.length > 0) {
            return res[0].channelIds
        }

        return []
    }

    async findAllChannelIdToNotify(region: Region, channelId: string, lineupSize: number): Promise<string[]> {
        const res = await Lineup.aggregate([
            {
                $match: {
                    'team.region': region,
                    type: { $nin: [LINEUP_TYPE_MIX, LINEUP_TYPE_CAPTAINS] },
                    channelId: { $ne: channelId },
                    size: lineupSize
                }
            },
            {
                $group: {
                    _id: null,
                    channelIds: {
                        $addToSet: '$$ROOT.channelId'
                    }
                }
            }
        ])

        if (res.length > 0) {
            return res[0].channelIds
        }

        return []
    }

    createLineup(channelId: string, size: number, name: string = '', autoSearch: boolean, allowRanked: boolean, team: ITeam, type: string, visibility: string, autoMatchmaking: boolean): ILineup {
        const defaultRoles = DEFAULT_PLAYER_ROLES.get(size)!

        let roles = defaultRoles.map(obj => ({ ...obj, lineupNumber: 1 }))
        if (type === LINEUP_TYPE_MIX || type === LINEUP_TYPE_SOLO) {
            roles = roles.concat(defaultRoles.map(obj => ({ ...obj, lineupNumber: 2 })))
        } else if (type === LINEUP_TYPE_CAPTAINS) {
            roles = []
            let i = 1
            while (i < size) {
                roles.push({ name: i, lineupNumber: 1, type: ROLE_MIX_CAPTAINS, pos: 0 })
                i++
            }
            while (i < (size * 2) - 1) {
                roles.push({ name: i, lineupNumber: 2, type: ROLE_MIX_CAPTAINS, pos: 0 })
                i++
            }
            roles.push({ ...GK, lineupNumber: 1, pos: 0 })
            roles.push({ ...GK, lineupNumber: 2, pos: 0 })
        }
        return new Lineup({
            channelId,
            size,
            roles,
            bench: [],
            name,
            autoMatchmaking,
            autoSearch,
            allowRanked,
            team,
            type,
            visibility
        })
    }

    async updateLastNotificationTime(channelId: string, time: Date): Promise<UpdateWriteOpResult> {
        return Lineup.updateOne({ channelId }, { 'lastNotificationTime': time })
    }

    async deleteBansByGuildId(guildId: string): Promise<DeleteResult> {
        return Bans.deleteMany({ guildId })
    }

    async deleteBanByUserIdAndGuildId(userId: string, guildId: string): Promise<DeleteResult> {
        return Bans.deleteOne({ userId, guildId })
    }

    async findBanByUserIdAndGuildId(userId: string, guildId: string): Promise<IBan | null> {
        return Bans.findOne({ userId, guildId })
    }

    async findBansByGuildId(guildId: string): Promise<IBan[]> {
        return Bans.find({ guildId })
    }

    getBenchUserToTransfer(lineup: ILineup, roleLeft?: IRole): IUser | null {
        if (lineup.bench.length === 0 || !roleLeft) {
            return null
        }

        let benchRole
        if (lineup.isSoloQueue()) {
            benchRole = lineup.bench.find(role => role.roles.some(r => (r.name === roleLeft.name && r.lineupNumber === roleLeft.lineupNumber) || r.name === ROLE_NAME_ANY))
        } else {
            benchRole = lineup.bench.find(role => role.roles.some(r => (r.name === roleLeft.name || r.name === ROLE_NAME_ANY) && r.lineupNumber === roleLeft.lineupNumber))
        }
        return benchRole ? benchRole.user : null
    }

    async addCaptain(guildId: string, user: IUser): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId }, { $push: { 'team.captains': user }, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { $push: { captains: user }, verified: false }, { new: true })
    }

    async removeCaptain(guildId: string, userId: string): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId }, { $pull: { 'team.captains': { "id": userId } }, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { $pull: { captains: { "id": userId } }, verified: false }, { new: true })
    }

    async addPlayer(guildId: string, user: IUser): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId }, { $push: { 'team.players': user }, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { $push: { players: user }, verified: false }, { new: true })
    }

    async removePlayer(guildId: string, userId: string): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId }, { $pull: { 'team.players': { "id": userId } }, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { $pull: { players: { "id": userId } }, verified: false }, { new: true })
    }

    async updateTeamType(guildId: string, type: TeamType): Promise<ITeam | null> {
        await LineupQueue.updateMany({ 'lineup.team.guildId': guildId }, { 'lineup.team.type': type, 'lineup.team.verified': false })
        await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.type': type, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { type, verified: false }, { new: true })
    }

    async updateTeamLogo(guildId: string, logo: string | null): Promise<ITeam | null> {
        await LineupQueue.updateMany({ 'lineup.team.guildId': guildId }, { 'lineup.team.logo': logo, 'lineup.team.verified': false })
        await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.logo': logo, 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { logo, verified: false }, { new: true })
    }

    async updateTeamName(guildId: string, name: string): Promise<ITeam | null> {
        await LineupQueue.updateMany({ 'lineup.team.guildId': guildId }, { 'lineup.team.name': name, 'lineup.team.nameUpperCase': name.toUpperCase(), 'lineup.team.verified': false })
        await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.name': name, 'team.nameUpperCase': name.toUpperCase(), 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { name, nameUpperCase: name.toUpperCase(), verified: false }, { new: true })
    }

    async updateTeamCode(guildId: string, code: string): Promise<ITeam | null> {
        await LineupQueue.updateMany({ 'lineup.team.guildId': guildId }, { 'lineup.team.code': code, 'lineup.team.codeUpperCase': code.toUpperCase(), 'lineup.team.verified': false })
        await Lineup.updateMany({ 'team.guildId': guildId }, { 'team.code': code, 'team.codeUpperCase': code.toUpperCase(), 'team.verified': false })
        return Team.findOneAndUpdate({ guildId }, { code: code, codeUpperCase: code.toUpperCase(), verified: false }, { new: true })
    }

    async verify(guildId: string, verified: boolean): Promise<ITeam | null> {
        await Lineup.updateMany({ 'team.guildId': guildId, type: LINEUP_TYPE_TEAM }, { 'team.verified': verified })
        return await Team.findOneAndUpdate({ guildId }, { verified }, { new: true })
    }

    async findTeams(userId: string): Promise<ITeam[]> {
        return Team.find({ $or: [{ 'captains.id': userId }, { 'players.id': userId }] })
    }

    async findAllVerifiedTeams(region: Region): Promise<ITeam[]> {
        return Team.find({ region, verified: true })
    }

    async notifyNoLongerVerified(client: Client, team: ITeam, reason?: string) {
        const regionData = regionService.getRegionData(team.region)
        const officialGuild = await client.guilds.fetch(regionData.guildId) as Guild
        const informationEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTimestamp()
            .setTitle('🛑 Team Unverified')
        let description = '**Your team is no longer verified.**'
        description += `\n\nPlease contact the admins of the official **${officialGuild.name}** discord to get your team verified by providing your team id: **${team.guildId}**.`
        informationEmbed.setDescription(description)
        if (reason) {
            informationEmbed.addFields([{ name: 'Reason', value: `*${reason}*` }])
        }
        await teamService.sendMessage(client, team.guildId, { embeds: [informationEmbed] })

        informationEmbed.setDescription(`The team ${team.prettyPrintName()} (${team.guildId}) has been unverified.`)
        await regionService.sendToModerationChannel(client, team.region, { embeds: [informationEmbed] })
    }

    async sendMessage(client: Client, guildId: string, messageOptions: MessageOptions): Promise<void> {
        const channelIds = await this.findChannelIdsByGuildId(guildId)
        await Promise.all(channelIds.map(async channelId => {
            const [channel] = await handle(client.channels.fetch(channelId))
            if (channel instanceof TextChannel) {
                channel?.send(messageOptions)
            }
        }))
    }

    async notifyAndPurgeInactiveTeams(client: Client): Promise<void> {
        const daysBeforeWarning = 30
        const reprieveDays = 15
        const dateBeforeWarning = new Date()
        dateBeforeWarning.setDate(dateBeforeWarning.getDate() - daysBeforeWarning)
        const dateBeforeDeletion = new Date()
        dateBeforeDeletion.setDate(dateBeforeDeletion.getDate() - daysBeforeWarning - reprieveDays)

        const inactiveGuildIdsToDelete = (await Team.find({ lastMatchDate: { "$lt": dateBeforeDeletion } }, { guildId: 1 })).map(team => team.guildId)
        inactiveGuildIdsToDelete.forEach(async (guildId) => {
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('❌ Inactive Team Deletion ❌')
                .setDescription(`Your team has been automatically deleted because of ${daysBeforeWarning + reprieveDays} days of inactivity`)
            await this.sendMessage(client, guildId, { embeds: [informationEmbed] })
            await this.deleteTeam(guildId)
        })

        const inactiveTeamsToWarn = (await Team.find({ lastMatchDate: { "$lt": dateBeforeWarning }, guildId: { $nin: inactiveGuildIdsToDelete } }, { guildId: 1, lastMatchDate: 1 }))
        inactiveTeamsToWarn.forEach(async (team) => {
            const deletionDate = Math.floor((new Date().getTime() + team.lastMatchDate!.getTime() - dateBeforeDeletion.getTime()) / 1000)
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('⚠ Inactive Team Warning ⚠')
                .setDescription(`Your team has not played since more than ${daysBeforeWarning} days. If you don't play, it will be automatically deleted <t:${deletionDate}:R>`)
            await this.sendMessage(client, team.guildId, { embeds: [informationEmbed] })
        })

        const guildIdsToIgnore = inactiveGuildIdsToDelete.concat(inactiveTeamsToWarn.map(team => team.guildId))
        const inactiveChannelIdsToDelete = (await Lineup.find({ lastMatchDate: { "$lt": dateBeforeDeletion }, 'team.guildId': { $nin: guildIdsToIgnore } }, { channelId: 1 })).map(lineup => lineup.channelId)
        inactiveChannelIdsToDelete.forEach(async (channelId) => {
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('❌ Inactive Lineup Deletion ❌')
                .setDescription(`This lineup has been automatically deleted because of ${daysBeforeWarning + reprieveDays} days of inactivity`)
            const [channel] = await handle(client.channels.fetch(channelId))
            if (channel instanceof TextChannel) {
                channel?.send({ embeds: [informationEmbed] })
            }
            await this.deleteLineup(channelId)
        })

        const inactiveLineupsToWarn = (await Lineup.find({ lastMatchDate: { "$lt": dateBeforeWarning }, channelId: { $nin: inactiveChannelIdsToDelete }, 'team.guildId': { $nin: guildIdsToIgnore } }, { channelId: 1, lastMatchDate: 1 }))
        inactiveLineupsToWarn.forEach(async (lineup) => {
            const deletionDate = Math.floor((new Date().getTime() + lineup.lastMatchDate!.getTime() - dateBeforeDeletion.getTime()) / 1000)
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('⚠ Inactive Lineup Warning ⚠')
                .setDescription(`This lineup has not played since more than ${daysBeforeWarning} days. If you don't play, it will be automatically deleted <t:${deletionDate}:R> `)
            const [channel] = await handle(client.channels.fetch(lineup.channelId))
            if (channel instanceof TextChannel) {
                channel?.send({ embeds: [informationEmbed] })
            }
        })
    }

    private removeSpecialCharacters(name: string): string {
        return name.replace(/(:[^:]*:)|(<.*>)|\*/ig, '');
    }
}

export const teamService = new TeamService()

export interface RankedStats {
    role: IRole,
    stats: IStats
}