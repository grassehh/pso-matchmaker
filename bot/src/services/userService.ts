import { Client, User as DiscordUser, EmbedBuilder } from "discord.js"
import { UpdateWriteOpResult } from "mongoose"
import { IUser, User, PlayerStats, Lineup, Team, IPlayerBan } from "../mongoSchema"
import { teamService } from "./teamService"
import { handle } from "../utils"

class UserService {
    async findUserByDiscordUserId(discordUserId: string): Promise<IUser | null> {
        return User.findOne({ id: discordUserId })
    }

    async createUserFromDiscordUser(discordUser: DiscordUser): Promise<IUser> {
        return await new User({
            id: discordUser.id,
            name: discordUser.username,
            mention: discordUser.toString()
        } as IUser).save()
    }

    async findOrCreateUserByDiscordUserId(discordUserId: string): Promise<IUser | null> {
        return User.findOne({ id: discordUserId })
    }

    async findUserBySteamId(steamId: string): Promise<IUser | null> {
        return User.findOne({ steamId })
    }

    async updateSteamId(discordUserId: string, newSteamId?: string): Promise<UpdateWriteOpResult | null> {
        return User.updateOne({ id: discordUserId }, { $set: { steamId: newSteamId } })
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

    async notifyBanned(client: Client, ban: IPlayerBan) {
        const [user] = await handle(client.users.fetch(ban.userId))
        const [guild] = await handle(client.guilds.fetch(ban.guildId))
        if (user && guild) {
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('⛔ Banned')
            let description = `You have been ${ban.expireAt ? `banned until **${ban.expireAt.toUTCString()}**` : '**permanently** banned'} from the **${guild.name}** Discord matchmaking`
            informationEmbed.setDescription(description)
            if (ban.reason) {
                informationEmbed.addFields([{ name: 'Reason', value: `*${ban.reason}*` }])
            }
            await handle(user.send({ embeds: [informationEmbed] }))
        }
    }

    async notifyUnbanned(client: Client, userId: string) {
        const [user] = await handle(client.users.fetch(userId))
        if (user) {
            const informationEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTimestamp()
                .setTitle('✅ Unbanned')
            let description = 'You are now **unbanned**'
            informationEmbed.setDescription(description)
            await handle(user.send({ embeds: [informationEmbed] }))
        }
    }
}

export const userService = new UserService()