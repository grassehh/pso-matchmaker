import { UpdateWriteOpResult } from "mongoose"
import { IUser, User, Stats, Lineup, Team } from "../mongoSchema"

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

    async deleteUser(discordUserId: string): Promise<void | null> {
        Promise.all([
            User.deleteOne({ id: discordUserId }),
            Stats.deleteMany({ userId: discordUserId }),
            Lineup.updateMany({}, { $pull: { 'team.players': { id: discordUserId }, 'team.captains': { id: discordUserId } }, 'team.verified': false }),
            Team.updateMany({}, { $pull: { players: { id: discordUserId }, captains: { id: discordUserId } }, verified: false }, { new: true })
        ])
    }
}

export const userService = new UserService()