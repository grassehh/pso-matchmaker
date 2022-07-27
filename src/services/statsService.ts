import { ButtonInteraction, CommandInteraction, GuildMember, Role, SelectMenuInteraction } from "discord.js"
import { MERC_USER_ID, MINIMUM_LINEUP_SIZE_FOR_RANKED } from "../constants"
import { IStats, Stats } from "../mongoSchema"
import { handle } from "../utils"

export default class StatsService {
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

    async countNumberOfPlayers(region?: string): Promise<number> {
        return (await Stats.distinct('userId', region ? { region } : {})).length
    }

    async findStats(userId?: string, region?: string, page?: number, size?: number): Promise<IStats[]> {
        const skip = (!page || !size) ? 0 : page * size
        let pipeline = <any>[]

        let match: any = {}
        if (userId) {
            match.userId = userId;
        }

        if (region) {
            match.region = region;
        }
        pipeline.push({ $match: match })

        if (userId) {
            pipeline.push(
                {
                    $group: {
                        _id: null,
                        numberOfGames: {
                            $sum: '$numberOfGames'
                        },
                        numberOfRankedGames: {
                            $sum: '$numberOfRankedGames'
                        }
                    }
                })
        } else {
            pipeline = pipeline.concat([
                {
                    $group: {
                        _id: '$userId',
                        numberOfGames: {
                            $sum: '$numberOfGames'
                        },
                        numberOfRankedGames: {
                            $sum: '$numberOfRankedGames'
                        }
                    }
                },
                {
                    $sort: { 'numberOfRankedGames': -1 },
                },
                {
                    $skip: skip
                },
                {
                    $limit: size
                }
            ])
        }

        return Stats.aggregate(pipeline)
    }

    async updateStats(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, region: string, lineupSize: number, userIds: string[]): Promise<void> {
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
                        numberOfRankedGames: lineupSize >= MINIMUM_LINEUP_SIZE_FOR_RANKED ? 1 : 0
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

        if (region === 'EU' && lineupSize >= MINIMUM_LINEUP_SIZE_FOR_RANKED) {
            const psoEuGuild = await interaction.client.guilds.fetch(process.env.PSO_EU_DISCORD_GUILD_ID as string)
            const usersStats = await this.findUsersStats(nonMercUserIds)

            await Promise.all(usersStats.map(async (userStats: IStats) => {
                const levelingRoleId = this.getLevelingRoleIdFromStats(userStats)
                const [member] = await handle(psoEuGuild.members.fetch(userStats._id.toString()))
                if (member instanceof GuildMember) {
                    await handle(member.roles.add(levelingRoleId))
                    if (levelingRoleId === process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID) {
                        await handle(member.roles.remove(process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID as string))
                    } else if (levelingRoleId === process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID) {
                        await handle(member.roles.remove(process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID as string))
                    } else if (levelingRoleId === process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID) {
                        await handle(member.roles.remove(process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID as string))
                    }
                }
            }))
        }
    }

    private getLevelingRoleIdFromStats(userStats: IStats): string {
        if (userStats.numberOfRankedGames >= 800) {
            return process.env.PSO_EU_DISCORD_VETERAN_ROLE_ID as string
        }
        if (userStats.numberOfRankedGames >= 250) {
            return process.env.PSO_EU_DISCORD_SENIOR_ROLE_ID as string
        }
        if (userStats.numberOfRankedGames >= 25) {
            return process.env.PSO_EU_DISCORD_REGULAR_ROLE_ID as string
        }

        return process.env.PSO_EU_DISCORD_CASUAL_ROLE_ID as string
    }

    private async findUsersStats(userIds: string[]): Promise<IStats[]> {
        return Stats.aggregate([
            {
                $match: {
                    userId: {
                        $in: userIds
                    }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    numberOfGames: {
                        $sum: '$numberOfGames',
                    },
                    numberOfRankedGames: {
                        $sum: '$numberOfRankedGames',
                    }
                }
            }
        ])
    }
}