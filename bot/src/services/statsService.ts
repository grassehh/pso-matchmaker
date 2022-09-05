import { BaseMessageOptions, Client, EmbedBuilder, GuildMember } from "discord.js"
import { DEFAULT_RATING, MERC_USER_ID, MIN_LINEUP_SIZE_FOR_RANKED, RATING_DOWNGRADE_AMOUNT } from "../constants"
import { IPlayerStats, ITeam, ITeamStats, Lineup, LineupQueue, PlayerStats, Team, TeamStats } from "../mongoSchema"
import { handle } from "../utils"
import { GameType, interactionUtils, StatsType } from "./interactionUtils"
import { Region, regionService } from "./regionService"
import { teamService, TeamType } from "./teamService"

class StatsService {

    async countNumberOfPlayers(region: Region): Promise<number> {
        return (await PlayerStats.distinct('userId', region !== Region.INTERNATIONAL ? { region } : {})).length
    }

    async countNumberOfTeams(region: Region, teamType?: TeamType): Promise<number> {
        const match: any = {}
        if (region !== Region.INTERNATIONAL) {
            match.region = region
        }
        if (teamType) {
            match.type = teamType
        }
        return (await TeamStats.distinct('guildId', match)).length
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
                        await regionService.updateMemberActivityRole(region, member, stats.numberOfRankedGames)
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

    async findPaginatedTeamsStats(page: number, pageSize: number, region: Region, teamType?: TeamType): Promise<ITeamStats[]> {
        let match: any = {}
        if (region !== Region.INTERNATIONAL) {
            match.region = region;
        }
        if (teamType) {
            match.type = teamType
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

    async endSeason(client: Client): Promise<void> {
        const allRegionData = regionService.getAllRegionsData()
        for (const regionData of allRegionData) {
            const newTier1PlayersRating = regionData.tier2Threshold! - 100
            const newTier2PlayersRating = (regionData.tier2Threshold! + regionData.tier3Threshold!) / 2
            const newTier3PlayersRating = regionData.tier3Threshold! + 100
            const regionGuild = await regionService.getRegionGuild(client, regionData.region)
            if (regionGuild) {
                const resultsEmbed = new EmbedBuilder().setTitle("📢 Season Ended !")
                const announcementMessage: BaseMessageOptions = { content: '@everyone', embeds: [resultsEmbed] }
                const teamStats = await this.findPaginatedTeamsStats(0, 1, regionData.region)
                if (teamStats.length > 0) {
                    const winningTeam = await teamService.findTeamByGuildId(teamStats[0]._id.toString()) as ITeam
                    let description = `🎊 **Congratulations** 🎊 to the following team for winning this Season: ${winningTeam.prettyPrintName()} !`

                    const seasonWinnerRoleId = regionData.seasonWinnerRoleId
                    if (seasonWinnerRoleId) {
                        const seasonWinnerRole = await regionGuild.roles.fetch(seasonWinnerRoleId)

                        for (const member of seasonWinnerRole!.members) {
                            await member[1].roles.remove(seasonWinnerRoleId)
                        }

                        const winningTeamUserIds = winningTeam.captains.map(captain => captain.id).concat(winningTeam.players.map(player => player.id))
                        const winningTeamMembers = await regionGuild.members.fetch({ user: winningTeamUserIds })
                        for (const member of winningTeamMembers) {
                            await member[1].roles.add(seasonWinnerRoleId)
                        }
                        description += `
                    \nAnd congratulations to the players of the team who will receive the <@&${seasonWinnerRoleId}> role:
                       ${winningTeamMembers.map(member => `- ${member.toString()}`)}
                    `
                    }
                    const teamLeaderboardEmbed = await interactionUtils.createTeamsLeaderboardEmbed(1, { page: 0, pageSize: 3, gameType: GameType.TEAM_AND_MIX, region: regionData.region, statsType: StatsType.TEAMS })
                    teamLeaderboardEmbed.setTitle('👕 Season Top 3 Teams 👕')
                    announcementMessage.embeds!.push(teamLeaderboardEmbed)
                    const playerLeadeboardEmbed = await interactionUtils.createPlayersLeaderboardEmbed(client.users, 1, { page: 0, pageSize: 3, gameType: GameType.TEAM_AND_MIX, region: regionData.region, statsType: StatsType.PLAYERS })
                    playerLeadeboardEmbed.setTitle('🤾‍♂️ Season Top 3 Players 🤾‍♂️')
                    announcementMessage.embeds!.push(playerLeadeboardEmbed)
                    resultsEmbed.setDescription(description)
                }

                const statsResetEmbed = new EmbedBuilder().setTitle("How are the stats reset ?")
                    .setDescription(`
                        **Teams ratings** will be reset to **${DEFAULT_RATING}**

                        **Players ratings** will be reset depending on their tier:
                        - Tier 1 (< **${regionData.tier2Threshold}**) will be reset to **${newTier1PlayersRating}**
                        - Tier 2 (**${regionData.tier2Threshold}-${regionData.tier3Threshold}**) will be reset to **${newTier2PlayersRating}**
                        - Tier 3 (> **${regionData.tier2Threshold}**) will be reset to **${newTier3PlayersRating}**
                `)
                announcementMessage.embeds!.push(statsResetEmbed)

                await regionService.sendToAnnouncementsChannel(client, regionData.region, announcementMessage)
            }

            const playersStats = await PlayerStats.find({ region: regionData.region })
            const playersStatsBulks: any = []
            for (const playerStats of playersStats) {
                const tierRoleId = regionService.getTierRoleId(regionData.region, playerStats.rating)
                let rating = DEFAULT_RATING
                if (tierRoleId) {
                    if (tierRoleId === regionData.tier1RoleId) {
                        rating = newTier1PlayersRating
                    } else if (tierRoleId === regionData.tier2RoleId) {
                        rating = newTier2PlayersRating
                    } else {
                        rating = newTier3PlayersRating
                    }
                }
                playersStatsBulks.push({
                    updateOne: {
                        filter: { _id: playerStats._id },
                        update: {
                            $set: {
                                rating,
                                numberOfRankedWins: 0,
                                numberOfRankedDraws: 0,
                                numberOfRankedLosses: 0
                            }
                        }
                    }
                })
            }
            await PlayerStats.bulkWrite(playersStatsBulks)

            const teamsStats = await TeamStats.find({ region: regionData.region })
            const teamsStatsBulks: any = []
            for (const teamStats of teamsStats) {
                teamsStatsBulks.push({
                    updateOne: {
                        filter: { _id: teamStats._id },
                        update: {
                            $set: {
                                rating: DEFAULT_RATING,
                                numberOfRankedWins: 0,
                                numberOfRankedDraws: 0,
                                numberOfRankedLosses: 0
                            }
                        }
                    }
                })
            }
            await TeamStats.bulkWrite(teamsStatsBulks)
        }

        await Team.updateMany({}, { $set: { rating: DEFAULT_RATING } })
        await Lineup.updateMany({}, { $set: { 'team.rating': DEFAULT_RATING } })
        await LineupQueue.updateMany({}, { $set: { 'lineup.team.rating': DEFAULT_RATING } })
    }
}

export const statsService = new StatsService()