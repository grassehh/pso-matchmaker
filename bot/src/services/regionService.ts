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
    readonly matchResultsChannelId?: string
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
                matchResultsChannelId: process.env[`PSO_${key}_DISCORD_MATCH_RESULTS_CHANNEL_ID`] as string,
            } as RegionData
            this.regionsDataByRegion.set(key, regionData)
            this.regionsDataByGuildId.set(regionData.guildId, regionData)
        }
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
}
export const regionService = new RegionService()