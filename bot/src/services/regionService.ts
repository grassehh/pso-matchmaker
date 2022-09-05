import { Client, Guild, GuildMember, MessageOptions, PermissionFlagsBits, TextChannel } from "discord.js"
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
    INTERNATIONAL = 'INTERNATIONAL'
}

interface RegionData {
    readonly region: Region
    readonly label: string
    readonly guildId: string
    readonly moderationChannelId?: string
    readonly bansListChannelId?: string
    readonly matchResultsChannelId?: string
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

    async updateMemberActivityRole(member: GuildMember, numberOfMatches: number): Promise<void> {
        const newActivityRoleId = this.getActivityRoleId(numberOfMatches)
        if (member.roles.cache.some(role => role.id === newActivityRoleId)) {
            return
        }
        await handle(member.roles.remove(this.getAllActivityRolesId()))
        await handle(member.roles.add(newActivityRoleId))
    }

    getAvailableTierRoleIds(region: Region, rating: number): string[] {
        const regionData = this.getRegionData(region)
        if (!this.areTierRoleIdsDefined(regionData)) {
            return []
        }

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
        const regionData = this.getRegionData(region)
        if (!this.areTierRoleIdsDefined(regionData)) {
            return undefined
        }

        if (rating >= regionData.tier3Threshold!) {
            return regionData.tier3RoleId as string
        }
        if (rating >= regionData.tier2Threshold!) {
            return regionData.tier2RoleId as string
        }
        return regionData.tier1RoleId as string
    }

    getAllTierRoleIds(region: Region): string[] {
        const regionData = this.getRegionData(region)
        if (!this.areTierRoleIdsDefined(regionData)) {
            return []
        }

        return [
            regionData.tier3RoleId as string,
            regionData.tier2RoleId as string,
            regionData.tier1RoleId as string
        ]
    }

    async sendToModerationChannel(client: Client, region: Region, messageOptions: MessageOptions) {
        const regionData = this.getRegionData(region)
        if (regionData.moderationChannelId) {
            const [channel] = await handle(client.channels.fetch(regionData.moderationChannelId))
            if (channel instanceof TextChannel) {
                await channel.send(messageOptions)
            }
        }
    }

    /**
     * This is used only in EU region
     */
    getActivityRoleId(numberOfGames: number): string {
        if (numberOfGames >= 800) {
            return process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID as string
        }
        if (numberOfGames >= 250) {
            return process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID as string
        }
        if (numberOfGames >= 25) {
            return process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID as string
        }

        return process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID as string
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

    private getAllActivityRolesId(): string[] {
        return [
            process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID as string,
            process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID as string,
            process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID as string,
            process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID as string
        ]
    }

    private areTierRoleIdsDefined(regionData: RegionData) {
        return regionData.tier1RoleId && regionData.tier2RoleId && regionData.tier2Threshold
    }
}

export const regionService = new RegionService()
