import { Client, User as DiscordUser } from "discord.js"
import { UpdateWriteOpResult } from "mongoose"
import { IUser, User, PlayerStats, Lineup, Team } from "../mongoSchema"
import { teamService } from "./teamService"

class UserService {
    async findUserByDiscordUserId(discordUserId: string): Promise<IUser | null> {
        return User.findOne({ id: discordUserId })
    }

    async findUserBySteamId(steamId: string): Promise<IUser | null> {
        return User.findOne({ steamId })
    }

    async logout(discordUserId: string): Promise<UpdateWriteOpResult | null> {
        return User.findOneAndUpdate({ id: discordUserId }, { $unset: { steamId: "" } })
    }

    async deleteUser(client: Client, user: DiscordUser): Promise<void | null> {
        const userTeams = await teamService.findTeams(user.id)
        await Promise.all(userTeams.map(team => {
            teamService.verify(team.guildId, false)
            teamService.notifyNoLongerVerified(client, team, `${user} unregistered from the PSO Matchmaker bot`)
        }))

        await Promise.all([
            User.deleteOne({ id: user.id }),
            PlayerStats.deleteMany({ userId: user.id }),
            Lineup.updateMany({}, { $pull: { 'team.players': { id: user.id }, 'team.captains': { id: user.id } } }),
            Team.updateMany({}, { $pull: { players: { id: user.id }, captains: { id: user.id } } })
        ])
    }
}

export const userService = new UserService()