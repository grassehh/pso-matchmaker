import { IUser, User } from "../mongoSchema"

class UserService {
    async findUserByDiscordUserId(discordUserId: string): Promise<IUser | null> {
        return User.findOne({ id: discordUserId })
    }

    async findUserBySteamId(steamId: string): Promise<IUser | null> {
        return User.findOne({ steamId })
    }
}

export const userService = new UserService()