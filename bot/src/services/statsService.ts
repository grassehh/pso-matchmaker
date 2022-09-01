import { Client, GuildMember, Role } from "discord.js"
import { MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED, RATING_DOWNGRADE_AMOUNT } from "../constants"
import { IStats, ITeam, Stats, Team } from "../mongoSchema"
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
        return (await Stats.distinct('userId', region !== Region.INTERNATIONAL ? { region } : {})).length
    }

    async countNumberOfTeams(region: Region): Promise<number> {
        return (await Team.count(region !== Region.INTERNATIONAL ? { region, verified: true, rating: { $exists: true } } : { verified: true, rating: { $exists: true } }))
    }

    async findPlayersStats(page: number, pageSize: number, gameType: GameType, region?: Region): Promise<IStats[]> {
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
                    rating: { $avg: rating }
                }
            },
            {
                $sort: { 'rating': -1 }
            },
            {
                $skip: page * pageSize
            },
            {
                $limit: pageSize
            }
        ]

        return Stats.aggregate(pipeline)
    }

    async updateStats(client: Client, region: Region, lineupSize: number, userIds: string[]): Promise<void> {
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
        await Stats.bulkWrite(bulks)

        if (lineupSize >= MIN_LINEUP_SIZE_FOR_RANKED) {
            const regionGuild = await regionService.getRegionGuild(client, region)
            if (regionGuild) {
                const usersStats = await this.findUsersStats(nonMercUserIds, region)
                await Promise.all(usersStats.map(async (userStats) => {
                    const stats = Stats.hydrate(userStats)
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

    async findUsersStats(userIds: string[], region: Region): Promise<IStats[]> {
        let match: any = { userId: { $in: userIds } }
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        return Stats.aggregate([
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

    async findUserStats(userId: string, region: Region): Promise<IStats | null> {
        return Stats.findOne({ userId, region })
    }

    async updatePlayerRating(userId: string, region: Region, newStats: IStats): Promise<IStats | null> {
        return Stats.findOneAndUpdate(
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

    async findTeamsStats(page: number, pageSize: number, region: Region): Promise<ITeam[] | null> {
        let match: any = { verified: true, rating: { $exists: true } }
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }

        return Team.aggregate([
            { $match: match },
            { $sort: { 'rating': -1 }, },
            { $skip: page * pageSize },
            { $limit: pageSize }
        ])
    }

    async downgradePlayerStats(region: Region, userId: string): Promise<IStats | null> {
        return Stats.findOneAndUpdate({ userId, region }, { $inc: { rating: -RATING_DOWNGRADE_AMOUNT } }, { new: true })
    }
}

export const statsService = new StatsService()