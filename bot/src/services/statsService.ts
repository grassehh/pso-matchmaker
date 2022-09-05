import { Client, GuildMember, Role } from "discord.js"
import { MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED, RATING_DOWNGRADE_AMOUNT } from "../constants"
import { IPlayerStats, ITeamStats, PlayerStats, TeamStats } from "../mongoSchema"
import { handle } from "../utils"
import { GameType } from "./interactionUtils"
import { Region, regionService } from "./regionService"

class StatsService {
    getLevelEmojiFromMember(member: GuildMember): string {
        if (member.roles.cache.some((role: Role) => role.id === process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID)) {
            return '🔴 '
        }
        if (member.roles.cache.some((role: Role) => role.id === process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID)) {
            return '🟣 '
        }
        if (member.roles.cache.some((role: Role) => role.id === process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID)) {
            return '🟠 '
        }
        if (member.roles.cache.some((role: Role) => role.id === process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID)) {
            return '🟡 '
        }

        return ''
    }

    async countNumberOfPlayers(region: Region): Promise<number> {
        return (await PlayerStats.distinct('userId', region !== Region.INTERNATIONAL ? { region } : {})).length
    }

    async countNumberOfTeams(region: Region): Promise<number> {
        return (await TeamStats.distinct('guildId', region !== Region.INTERNATIONAL ? { region } : {})).length
    }

    async updatePlayersStats(client: Client, region: Region, lineupSize: number, userIds: string[]): Promise<void> {
        const nonMercUserIds = userIds.filter(userId => userId !== MERC_USER_ID)
        if (nonMercUserIds.length === 0) {
            return
        }

        const bulks = nonMercUserIds.map(userId => ({
            updateOne: {
                filter: {
                    region,
                    userId
                },
                update: {
                    $inc: {
                        numberOfRankedGames: lineupSize >= MIN_LINEUP_SIZE_FOR_RANKED ? 1 : 0
                    },
                    $setOnInsert: {
                        userId,
                        region
                    },
                },
                upsert: true
            }
        }))
        await PlayerStats.bulkWrite(bulks)

        if (lineupSize >= MIN_LINEUP_SIZE_FOR_RANKED) {
            const regionGuild = await regionService.getRegionGuild(client, region)
            if (regionGuild) {
                const usersStats = await this.findPlayersStats(nonMercUserIds, region)
                await Promise.all(usersStats.map(async (userStats) => {
                    const stats = PlayerStats.hydrate(userStats)
                    const [member] = await handle(regionGuild.members.fetch(userStats._id.toString()))
                    if (member instanceof GuildMember) {
                        await regionService.updateMemberTierRole(region, member, stats)

                        /**
                         * This is deprecated but we will keep it just for information
                         */
                        if (region === Region.EUROPE) {
                            await regionService.updateMemberActivityRole(member, stats.numberOfRankedGames)
                        }
                    }
                }))
            }
        }
    }

    async findPaginatedPlayersStats(page: number, pageSize: number, gameType: GameType, region?: Region): Promise<IPlayerStats[]> {
        let match: any = {}
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        const rating = gameType === GameType.TEAM_AND_MIX ? ["$rating"] : ["$mixCaptainsRating"]

        const pipeline = <any>[
            { $match: match },
            {
                $group: {
                    _id: '$userId',
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames'
                    },
                    numberOfRankedWins: {
                        $sum: '$numberOfRankedWins'
                    },
                    numberOfRankedDraws: {
                        $sum: '$numberOfRankedDraws'
                    },
                    numberOfRankedLosses: {
                        $sum: '$numberOfRankedLosses'
                    },
                    totalNumberOfRankedWins: {
                        $sum: '$totalNumberOfRankedWins'
                    },
                    totalNumberOfRankedDraws: {
                        $sum: '$totalNumberOfRankedDraws'
                    },
                    totalNumberOfRankedLosses: {
                        $sum: '$totalNumberOfRankedLosses'
                    },
                    rating: {
                        $avg: '$rating'
                    },
                    mixCaptainsRating: {
                        $avg: '$mixCaptainsRating'
                    }
                }
            },
            {
                $project: {
                    numberOfRankedGames: 1,
                    numberOfRankedWins: 1,
                    numberOfRankedDraws: 1,
                    numberOfRankedLosses: 1,
                    totalNumberOfRankedWins: 1,
                    totalNumberOfRankedDraws: 1,
                    totalNumberOfRankedLosses: 1,
                    totalNumberOfRankedGames: {
                        $sum: ['$totalNumberOfRankedWins', '$totalNumberOfRankedDraws', '$totalNumberOfRankedLosses']
                    },
                    rating: { $avg: rating }
                }
            },
            {
                $sort: {
                    'rating': -1,
                    'totalNumberOfRankedGames': 1
                }
            },
            {
                $skip: page * pageSize
            },
            {
                $limit: pageSize
            }
        ]

        return PlayerStats.aggregate(pipeline)
    }

    async findPlayersStats(userIds: string[], region: Region): Promise<IPlayerStats[]> {
        let match: any = { userId: { $in: userIds } }
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        return PlayerStats.aggregate([
            {
                $match: match
            },
            {
                $group: {
                    _id: '$userId',
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames',
                    },
                    numberOfRankedWins: {
                        $sum: '$numberOfRankedWins'
                    },
                    numberOfRankedDraws: {
                        $sum: '$numberOfRankedDraws'
                    },
                    numberOfRankedLosses: {
                        $sum: '$numberOfRankedLosses'
                    },
                    totalNumberOfRankedWins: {
                        $sum: '$totalNumberOfRankedWins'
                    },
                    totalNumberOfRankedDraws: {
                        $sum: '$totalNumberOfRankedDraws'
                    },
                    totalNumberOfRankedLosses: {
                        $sum: '$totalNumberOfRankedLosses'
                    },
                    rating: {
                        $avg: '$rating'
                    },
                    mixCaptainsRating: {
                        $avg: '$mixCaptainsRating'
                    }
                }
            }
        ])
    }

    async findPlayerStats(userId: string, region: Region): Promise<IPlayerStats | null> {
        return PlayerStats.findOne({ userId, region })
    }

    async updatePlayerRating(userId: string, region: Region, newStats: IPlayerStats): Promise<IPlayerStats | null> {
        return PlayerStats.findOneAndUpdate(
            { userId, region },
            {
                $set: {
                    numberOfRankedWins: newStats.numberOfRankedWins,
                    numberOfRankedDraws: newStats.numberOfRankedDraws,
                    numberOfRankedLosses: newStats.numberOfRankedLosses,
                    totalNumberOfRankedWins: newStats.totalNumberOfRankedWins,
                    totalNumberOfRankedDraws: newStats.totalNumberOfRankedDraws,
                    totalNumberOfRankedLosses: newStats.totalNumberOfRankedLosses,
                    rating: newStats.rating,
                    mixCaptainsRating: newStats.mixCaptainsRating
                }
            },
            { upsert: true }
        )
    }

    async downgradePlayerStats(region: Region, userId: string): Promise<IPlayerStats | null> {
        return PlayerStats.findOneAndUpdate({ userId, region }, { $inc: { rating: -RATING_DOWNGRADE_AMOUNT } }, { new: true })
    }

    async findPaginatedTeamsStats(page: number, pageSize: number, region: Region): Promise<ITeamStats[]> {
        let match: any = {}
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        const pipeline = <any>[
            { $match: match },
            {
                $group: {
                    _id: '$guildId',
                    numberOfRankedWins: {
                        $sum: '$numberOfRankedWins'
                    },
                    numberOfRankedDraws: {
                        $sum: '$numberOfRankedDraws'
                    },
                    numberOfRankedLosses: {
                        $sum: '$numberOfRankedLosses'
                    },
                    totalNumberOfRankedWins: {
                        $sum: '$totalNumberOfRankedWins'
                    },
                    totalNumberOfRankedDraws: {
                        $sum: '$totalNumberOfRankedDraws'
                    },
                    totalNumberOfRankedLosses: {
                        $sum: '$totalNumberOfRankedLosses'
                    },
                    rating: {
                        $avg: '$rating'
                    }
                }
            },
            {
                $project: {
                    numberOfRankedWins: 1,
                    numberOfRankedDraws: 1,
                    numberOfRankedLosses: 1,
                    totalNumberOfRankedWins: 1,
                    totalNumberOfRankedDraws: 1,
                    totalNumberOfRankedLosses: 1,
                    totalNumberOfRankedGames: {
                        $sum: ['$totalNumberOfRankedWins', '$totalNumberOfRankedDraws', '$totalNumberOfRankedLosses']
                    },
                    rating: { $avg: '$rating' }
                }
            },
            {
                $sort: {
                    'rating': -1,
                    'totalNumberOfRankedGames': 1
                }
            },
            {
                $skip: page * pageSize
            },
            {
                $limit: pageSize
            }
        ]

        return TeamStats.aggregate(pipeline)
    }


    async findTeamsStats(guildIds: string[], region: Region): Promise<ITeamStats[]> {
        let match: any = { guildId: { $in: guildIds } }
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        return TeamStats.aggregate([
            {
                $match: match
            },
            {
                $group: {
                    _id: '$guildId',
                    numberOfRankedWins: {
                        $sum: '$numberOfRankedWins'
                    },
                    numberOfRankedDraws: {
                        $sum: '$numberOfRankedDraws'
                    },
                    numberOfRankedLosses: {
                        $sum: '$numberOfRankedLosses'
                    },
                    totalNumberOfRankedWins: {
                        $sum: '$totalNumberOfRankedWins'
                    },
                    totalNumberOfRankedDraws: {
                        $sum: '$totalNumberOfRankedDraws'
                    },
                    totalNumberOfRankedLosses: {
                        $sum: '$totalNumberOfRankedLosses'
                    },
                    rating: {
                        $avg: '$rating'
                    }
                }
            }
        ])
    }

    async findTeamStats(guildId: string, region: Region): Promise<ITeamStats | null> {
        return TeamStats.findOne({ guildId, region })
    }
}

export const statsService = new StatsService()