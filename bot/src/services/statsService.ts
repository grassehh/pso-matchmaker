import { Client, GuildMember, Role } from "discord.js"
import { MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED } from "../constants"
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

        const ratingsAverage = gameType === GameType.TEAM_AND_MIX ? [
            "$attackRating",
            "$midfieldRating",
            "$defenseRating",
            "$goalKeeperRating"
        ] : ["$mixCaptainsRating"]

        const pipeline = <any>[
            { $match: match },
            {
                $group: {
                    _id: '$userId',
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames'
                    },
                    numberOfGames: {
                        $sum: '$numberOfGames'
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
                    attackRating: {
                        $avg: '$attackRating'
                    },
                    midfieldRating: {
                        $avg: '$midfieldRating'
                    },
                    defenseRating: {
                        $avg: '$defenseRating'
                    },
                    goalKeeperRating: {
                        $avg: '$goalKeeperRating'
                    },
                    mixCaptainsRating: {
                        $avg: '$mixCaptainsRating'
                    }
                }
            },
            {
                $project: {
                    numberOfRankedGames: 1,
                    numberOfGames: 1,
                    numberOfRankedWins: 1,
                    numberOfRankedDraws: 1,
                    numberOfRankedLosses: 1,
                    rating: { $avg: ratingsAverage }
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
                        numberOfGames: 1,
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

        /**
         * This is deprecated but we will keep it just for information
         */
        if (region === Region.EUROPE && lineupSize >= MIN_LINEUP_SIZE_FOR_RANKED) {
            const psoEuGuild = await client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID as string)
            const usersStats = await this.findUsersStats(nonMercUserIds, region)
            await Promise.all(usersStats.map(async (userStats: IStats) => {
                const [member] = await handle(psoEuGuild.members.fetch(userStats._id.toString()))
                if (member instanceof GuildMember) {
                    regionService.updateMemberActivityRole(member, userStats.numberOfRankedGames)
                }
            }))
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
                    numberOfGames: {
                        $sum: '$numberOfGames',
                    },
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
                    attackRating: {
                        $avg: '$attackRating'
                    },
                    midfieldRating: {
                        $avg: '$midfieldRating'
                    },
                    defenseRating: {
                        $avg: '$defenseRating'
                    },
                    goalKeeperRating: {
                        $avg: '$goalKeeperRating'
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
                    attackRating: newStats.attackRating,
                    defenseRating: newStats.defenseRating,
                    midfieldRating: newStats.midfieldRating,
                    goalKeeperRating: newStats.goalKeeperRating,
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
}

export const statsService = new StatsService()