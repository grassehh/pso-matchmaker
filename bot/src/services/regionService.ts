import { GuildMember } from "discord.js"
import { RATING_TIER_2_THRESHOLD, RATING_TIER_3_THRESHOLD } from "../constants"
import { handle } from "../utils"

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
    readonly bansListChannelId?: string
    readonly matchResultsChannelId?: string
    readonly tier1RoleId?: string
    readonly tier2RoleId?: string
    readonly tier3RoleId?: string
    readonly tier4RoleId?: string
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
                bansListChannelId: process.env[`PSO_${key}_DISCORD_BANS_LIST_CHANNEL_ID`] as string,
                matchResultsChannelId: process.env[`PSO_${key}_DISCORD_MATCH_RESULTS_CHANNEL_ID`] as string,
                tier1RoleId: process.env[`PSO_${key}_DISCORD_TIER_1_ROLE_ID`] as string,
                tier2RoleId: process.env[`PSO_${key}_DISCORD_TIER_2_ROLE_ID`] as string,
                tier3RoleId: process.env[`PSO_${key}_DISCORD_TIER_3_ROLE_ID`] as string,
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

    isOfficialDiscord(guildId: string): boolean {
        return this.regionsDataByGuildId.has(guildId)
    }

    async updateMemberTierRole(region: Region, member: GuildMember, oldAverageRating: number, newAverageRating: number): Promise<void> {
        const oldTierRoleId = this.getTierRoleId(region, oldAverageRating)
        const newTierRoleId = this.getTierRoleId(region, newAverageRating)

        if (!oldTierRoleId || !newTierRoleId) {
            return
        }

        await handle(member.roles.remove(oldTierRoleId))
        await handle(member.roles.add(newTierRoleId))
    }

    async updateActivityMemberRole(member: GuildMember, numberOfMatches: number): Promise<void> {
        const oldActivityRoleId = this.getActivityRole(numberOfMatches - 1)
        const newActivityRoleId = this.getActivityRole(numberOfMatches)
        console.log(`User with ID ${member.id}, oldActivityRole: ${oldActivityRoleId}, newActivityRole: ${newActivityRoleId}`)

        if (!oldActivityRoleId === !newActivityRoleId) {
            return
        }

        await handle(member.roles.remove(oldActivityRoleId))
        await handle(member.roles.add(newActivityRoleId))
    }

    getAvailableTierRoleIds(region: Region, rating: number): string[] {
        const regionData = this.getRegionData(region)
        const tierRoleIds: string[] = []
        if (rating >= RATING_TIER_3_THRESHOLD) {
            tierRoleIds.push(regionData.tier3RoleId as string)
        }
        if (rating >= RATING_TIER_2_THRESHOLD) {
            tierRoleIds.push(regionData.tier2RoleId as string)
        }
        tierRoleIds.push(regionData.tier1RoleId as string)

        return tierRoleIds
    }

    getTierRoleId(region: Region, rating: number): string {
        const regionData = this.getRegionData(region)
        if (rating >= RATING_TIER_3_THRESHOLD) {
            return regionData.tier3RoleId as string
        }
        if (rating >= RATING_TIER_2_THRESHOLD) {
            return regionData.tier2RoleId as string
        }
        return regionData.tier1RoleId as string
    }

    getAllTierRoleIds(region: Region): string[] {
        const regionData = this.getRegionData(region)
        return [
            regionData.tier3RoleId as string,
            regionData.tier2RoleId as string,
            regionData.tier1RoleId as string
        ]
    }

    /**
     * This is used only in EU region
     */
    private getActivityRole(numberOfGames: number): string {
        if (numberOfGames >= 800) {
            return process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID as string
        }
        if (numberOfGames >= 250) {
            return process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID as string
        }
        if (numberOfGames >= 5) {
            return process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID as string
        }

        return process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID as string
    }
}
export const regionService = new RegionService()