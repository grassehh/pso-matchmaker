import { Client, Guild, GuildMember, BaseMessageOptions, PermissionFlagsBits, TextChannel, Role } from "discord.js"
import { MINIMUM_MATCHES_BEFORE_RANKED } from "../constants"
import { IPlayerStats, ITeam } from "../mongoSchema"
import { handle } from "../utils"
import { TeamType } from "./teamService"

const dotenv = require("dotenv")
dotenv.config()

export enum Region {
    EUROPE = 'EU',
    NORTH_AMERICA = 'NA',
    SOUTH_AMERICA = 'SA',
    EAST_ASIA = 'AS',
    OCEANIA = 'OC',
    INTERNATIONAL = 'INTERNATIONAL'
}

interface RegionData {
    readonly region: Region
    readonly label: string
    readonly guildId: string
    readonly moderationChannelId?: string
    readonly bansListChannelId?: string
    readonly matchResultsChannelId?: string
    readonly casualRoleId?: string
    readonly regularRoleId?: string
    readonly seniorRoleId?: string
    readonly veteranRoleId?: string
    readonly tier1RoleId?: string
    readonly tier2RoleId?: string
    readonly tier2Threshold?: number
    readonly tier3RoleId?: string
    readonly tier3Threshold?: number
}

class RegionService {
    private readonly regionsDataByRegion: Map<string, RegionData> = new Map()
    private readonly regionsDataByGuildId: Map<string, RegionData> = new Map()

    constructor() {
        for (const region in Region) {
            const key = Region[region as keyof typeof Region]
            const regionData = {
                region: key as Region,
                label: process.env[`PSO_${key}_REGION_LABEL`] as string,
                guildId: process.env[`PSO_${key}_DISCORD_GUILD_ID`] as string,
                moderationChannelId: process.env[`PSO_${key}_DISCORD_MODERATION_CHANNEL_ID`] as string,
                bansListChannelId: process.env[`PSO_${key}_DISCORD_BANS_LIST_CHANNEL_ID`] as string,
                matchResultsChannelId: process.env[`PSO_${key}_DISCORD_MATCH_RESULTS_CHANNEL_ID`] as string,
                casualRoleId: process.env[`PSO_${key}_DISCORD_CASUAL_ROLE_ID`] as string,
                regularRoleId: process.env[`PSO_${key}_DISCORD_REGULAR_ROLE_ID`] as string,
                seniorRoleId: process.env[`PSO_${key}_DISCORD_SENIOR_ROLE_ID`] as string,
                veteranRoleId: process.env[`PSO_${key}_DISCORD_VETERAN_ROLE_ID`] as string,
                tier1RoleId: process.env[`PSO_${key}_DISCORD_TIER_1_ROLE_ID`] as string,
                tier2RoleId: process.env[`PSO_${key}_DISCORD_TIER_2_ROLE_ID`] as string,
                tier2Threshold: parseInt(process.env[`PSO_${key}_DISCORD_TIER_2_THRESHOLD`] as string),
                tier3RoleId: process.env[`PSO_${key}_DISCORD_TIER_3_ROLE_ID`] as string,
                tier3Threshold: parseInt(process.env[`PSO_${key}_DISCORD_TIER_3_THRESHOLD`] as string),
            } as RegionData
            this.regionsDataByRegion.set(key, regionData)
            this.regionsDataByGuildId.set(regionData.guildId, regionData)
        }
    }

    getAllRegionsData(): RegionData[] {
        return Array.from(this.regionsDataByRegion.values())
    }

    getRegionData(region: Region): RegionData {
        return this.regionsDataByRegion.get(region)!
    }

    getRegionByGuildId(guildId: string): Region | null {
        return this.regionsDataByGuildId.get(guildId)?.region || null
    }

    isRegionalDiscord(guildId: string): boolean {
        return this.regionsDataByGuildId.has(guildId)
    }

    async getRegionGuild(client: Client, region: Region): Promise<Guild | null> {
        return (await handle(client.guilds.fetch(regionService.getRegionData(region).guildId)))[0] || null
    }

    async sendToModerationChannel(client: Client, region: Region, BaseMessageOptions: BaseMessageOptions) {
        const regionData = this.getRegionData(region)
        if (regionData.moderationChannelId) {
            const [channel] = await handle(client.channels.fetch(regionData.moderationChannelId))
            if (channel instanceof TextChannel) {
                await channel.send(BaseMessageOptions)
            }
        }
    }

    async addTeamCodeToNickname(userId: string, team: ITeam, regionGuild: Guild | null) {
        if (regionGuild == null || !team.code || team.type !== TeamType.CLUB) {
            return
        }

        const [member] = await handle(regionGuild.members.fetch(userId))
        if (member && regionGuild!.members.me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            await handle(member.setNickname(`[${team.code}] ${member.displayName.replace(/^\[.*\] /i, '')}`))
        }
    }

    async removeTeamCodeFromNickName(userId: string, regionGuild: Guild | null) {
        if (regionGuild == null) {
            return
        }

        const [member] = await handle(regionGuild.members.fetch(userId))
        if (member && regionGuild!.members.me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            await handle(member.setNickname(`${member.displayName.replace(/^\[.*\] /i, '')}`))
        }
    }

    async updateMemberTierRole(region: Region, member: GuildMember, newStats: IPlayerStats): Promise<void> {
        if (newStats.numberOfRankedGames < MINIMUM_MATCHES_BEFORE_RANKED) {
            return
        }

        const newTierRoleId = this.getTierRoleId(region, newStats.rating)
        if (!newTierRoleId || member.roles.cache.some(role => role.id === newTierRoleId)) {
            return
        }

        await handle(member.roles.remove(this.getAllTierRoleIds(region)))
        await handle(member.roles.add(newTierRoleId))
    }

    async updateMemberActivityRole(region: Region, member: GuildMember, numberOfMatches: number): Promise<void> {
        const newActivityRoleId = this.getActivityRoleId(region, numberOfMatches)
        if (!newActivityRoleId || member.roles.cache.some(role => role.id === newActivityRoleId)) {
            return
        }

        await handle(member.roles.remove(this.getAllActivityRolesId(region)))
        await handle(member.roles.add(newActivityRoleId))
    }

    getAvailableTierRoleIds(region: Region, rating: number): string[] {
        if (!this.areTierRoleIdsDefined(region)) {
            return []
        }

        const regionData = this.getRegionData(region)
        const tierRoleIds: string[] = []
        if (rating >= regionData.tier3Threshold!) {
            tierRoleIds.push(regionData.tier3RoleId as string)
        }
        if (rating >= regionData.tier2Threshold!) {
            tierRoleIds.push(regionData.tier2RoleId as string)
        }
        tierRoleIds.push(regionData.tier1RoleId as string)

        return tierRoleIds
    }

    getTierRoleId(region: Region, rating: number): string | undefined {
        if (!this.areTierRoleIdsDefined(region)) {
            return undefined
        }

        const regionData = this.getRegionData(region)
        if (rating >= regionData.tier3Threshold!) {
            return regionData.tier3RoleId as string
        }
        if (rating >= regionData.tier2Threshold!) {
            return regionData.tier2RoleId as string
        }
        return regionData.tier1RoleId as string
    }

    getAllTierRoleIds(region: Region): string[] {
        if (!this.areTierRoleIdsDefined(region)) {
            return []
        }

        const regionData = this.getRegionData(region)
        return [
            regionData.tier3RoleId as string,
            regionData.tier2RoleId as string,
            regionData.tier1RoleId as string
        ]
    }

    getActivityRoleId(region: Region, numberOfGames: number): string | undefined {
        if (!this.areActivityRoleIdsDefined(region)) {
            return undefined
        }

        const regionData = this.getRegionData(region)
        if (numberOfGames >= 800) {
            return regionData.veteranRoleId
        }
        if (numberOfGames >= 250) {
            return regionData.seniorRoleId
        }
        if (numberOfGames >= 25) {
            return regionData.regularRoleId
        }

        return regionData.casualRoleId
    }

    getActivityRoleEmoji(region: Region, member: GuildMember): string | undefined {
        if (!this.areActivityRoleIdsDefined(region)) {
            return undefined
        }

        const regionData = this.getRegionData(region)
        if (member.roles.cache.some((role: Role) => role.id === regionData.veteranRoleId)) {
            return '🔴 '
        }
        if (member.roles.cache.some((role: Role) => role.id === regionData.seniorRoleId)) {
            return '🟣 '
        }
        if (member.roles.cache.some((role: Role) => role.id === regionData.regularRoleId)) {
            return '🟠 '
        }
        if (member.roles.cache.some((role: Role) => role.id === regionData.casualRoleId)) {
            return '🟡 '
        }

        return ''
    }

    private getAllActivityRolesId(region: Region): string[] {
        if (!this.areTierRoleIdsDefined(region)) {
            return []
        }

        const regionData = this.getRegionData(region)
        return [
            regionData.casualRoleId as string,
            regionData.regularRoleId as string,
            regionData.seniorRoleId as string,
            regionData.veteranRoleId as string
        ]
    }

    private areTierRoleIdsDefined(region: Region) {
        const regionData = this.getRegionData(region)
        return regionData.tier1RoleId && regionData.tier2RoleId && regionData.tier2Threshold
    }

    private areActivityRoleIdsDefined(region: Region) {
        const regionData = this.getRegionData(region)
        return regionData.casualRoleId && regionData.regularRoleId && regionData.seniorRoleId && regionData.veteranRoleId
    }
}

export const regionService = new RegionService()
