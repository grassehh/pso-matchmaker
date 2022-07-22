import { ButtonInteraction, Client, CommandInteraction, InteractionReplyOptions, Message, MessageActionRow, MessageButton, MessageEmbed, MessageOptions, SelectMenuInteraction, TextChannel, User } from "discord.js";
import { interactionUtils, statsService, teamService } from "../beans";
import { v4 as uuidv4 } from 'uuid';
import { MERC_USER_ID } from "../constants";
import { Challenge, IChallenge, ILineup, ILineupQueue, IMatch, IRole, IStats, ISub, IUser, LineupQueue, Match, Stats } from "../mongoSchema";
import { handle, notEmpty } from "../utils";
import { LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM } from "./teamService";
import { UpdateWriteOpResult, } from "mongoose";
import { DeleteResult } from "mongodb";
import { resolveBody } from "@discordjs/rest/dist/lib/utils/utils";

export default class MatchmakingService {
    isLineupAllowedToJoinQueue(lineup: ILineup): boolean {
        let numberOfPlayersSigned = lineup.roles.filter(role => role.user).length
        let lineupSize = lineup.isMixOrCaptains() ? lineup.size * 2 : lineup.size
        let numberOfMissingPlayers = lineupSize - numberOfPlayersSigned
        let missingRoleName = lineup.roles.find(role => !role.user)?.name || ''
        return numberOfMissingPlayers == 0 || (lineup.size > 3 && (numberOfMissingPlayers == 1 && missingRoleName.includes('GK')))
    }

    async updateBanList(client: Client): Promise<void> {
        const banListEmbed = await interactionUtils.createBanListEmbed(client, process.env.PSO_EU_DISCORD_GUILD_ID as string)
        const channel = await client.channels.fetch(process.env.PSO_EU_DISCORD_BANS_CHANNEL_ID as string) as TextChannel
        const messages = await channel.messages.fetch({ limit: 1 })
        if (messages.size === 0) {
            channel.send({ embeds: [banListEmbed] })
        } else {
            messages.first()?.edit({ embeds: [banListEmbed] })
                .catch(async () => channel.send({ embeds: [banListEmbed] }))
        }
    }

    async findLineupQueueByChannelId(channelId: string): Promise<ILineupQueue | null> {
        return LineupQueue.findOne({ 'lineup.channelId': channelId })
    }


    async findLineupQueueById(id: string): Promise<ILineupQueue | null> {
        return LineupQueue.findById(id)
    }


    async reserveLineupQueuesByIds(ids: string[], challengeId: string): Promise<UpdateWriteOpResult> {
        return LineupQueue.updateMany({ '_id': { $in: ids } }, { challengeId })
    }


    async freeLineupQueuesByChallengeId(challengeId: string): Promise<UpdateWriteOpResult> {
        return LineupQueue.updateMany({ challengeId }, { challengeId: null })
    }


    async deleteLineupQueuesByGuildId(guildId: string): Promise<DeleteResult> {
        return LineupQueue.deleteMany({ 'lineup.team.guildId': guildId })
    }


    async deleteLineupQueuesByChannelId(channelId: string): Promise<DeleteResult> {
        return LineupQueue.deleteMany({ 'lineup.channelId': channelId })
    }


    async findAvailableLineupQueues(region: string, channelId: string, lineupSize: number, guildId: string): Promise<ILineupQueue[]> {
        return LineupQueue.find(
            {
                'lineup.channelId': { '$ne': channelId },
                'lineup.team.region': region,
                'lineup.size': lineupSize,
                $or: [
                    { 'lineup.visibility': LINEUP_VISIBILITY_PUBLIC },
                    {
                        $and: [
                            { 'lineup.visibility': LINEUP_VISIBILITY_TEAM },
                            { 'lineup.team.guildId': guildId }
                        ]
                    }
                ],
                'challengeId': null
            }
        )
    }


    async findChallengeById(id: string): Promise<IChallenge | null> {
        return Challenge.findById(id)
    }


    async findChallengeByChannelId(channelId: string): Promise<IChallenge | null> {
        return Challenge.findOne({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })
    }


    async deleteChallengeById(id: string): Promise<DeleteResult> {
        return Challenge.deleteOne({ '_id': id })
    }


    async deleteChallengesByGuildId(guildId: string): Promise<void> {
        await Promise.all(
            [async () => {
                const challengeIds = (await Challenge.find({ $or: [{ 'initiatingTeam.lineup.team.guildId': guildId }, { 'challengedTeam.lineup.team.guildId': guildId }] }, { _id: 1 })).map(challenge => challenge._id.toString())
                this.freeLineupQueuesByChallengeIds(challengeIds)
            },
            Challenge.deleteMany({ $or: [{ 'initiatingTeam.lineup.team.guildId': guildId }, { 'challengedTeam.lineup.team.guildId': guildId }] })])
    }


    async deleteChallengesByChannelId(channelId: string): Promise<void> {
        await Promise.all(
            [async () => {
                const challengeIds = (await Challenge.find({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] }, { _id: 1 })).map(challenge => challenge._id.toString())
                this.freeLineupQueuesByChallengeIds(challengeIds)
            },
            Challenge.deleteMany({ $or: [{ 'initiatingTeam.lineup.channelId': channelId }, { 'challengedTeam.lineup.channelId': channelId }] })])
    }


    async addUserToLineupQueue(channelId: string, roleName: string, user: IUser, selectedLineup: number = 1): Promise<ILineupQueue | null> {
        return LineupQueue.findOneAndUpdate(
            {
                'lineup.channelId': channelId
            },
            {
                "$set": {
                    "lineup.roles.$[i].user": user
                }
            },
            {
                arrayFilters: [{ "i.lineupNumber": selectedLineup, "i.name": roleName }],
                new: true
            }
        )
    }


    async removeUserFromLineupQueue(channelId: string, userId: string): Promise<ILineupQueue | null> {
        return LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId, 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } }, { new: true })
    }


    async clearLineupQueue(channelId: string, selectedLineups = [1]): Promise<ILineupQueue | null> {
        return LineupQueue.findOneAndUpdate(
            {
                'lineup.channelId': channelId
            },
            {
                $set: {
                    "lineup.roles.$[i].user": null
                }
            },
            {
                arrayFilters: [{ "i.lineupNumber": { $in: selectedLineups } }]
            }
        )
    }


    async updateLineupQueueRoles(channelId: string, roles: IRole[]): Promise<ILineupQueue | null> {
        return LineupQueue.findOneAndUpdate({ 'lineup.channelId': channelId }, { 'lineup.roles': roles }, { new: true })
    }


    async joinQueue(client: Client, user: User, lineup: ILineup): Promise<ILineupQueue> {
        const lineupQueue = new LineupQueue({ lineup })
        const channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)

        let description = `**${teamService.formatTeamName(lineup)}**`
        const teamEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle('A team is looking for a match !')
            .setTimestamp()
        description += `\n${lineup.roles.filter(role => role.user != null).length} players signed`
        if (!teamService.hasGkSigned(lineupQueue.lineup)) {
            description += ' **(no GK)**'
        }
        description += `\n\n*Contact ${user} for more information*`
        teamEmbed.setDescription(description)

        const challengeTeamRow = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(`challenge_${lineupQueue.id}`)
                .setLabel('Challenge them !')
                .setEmoji('⚽')
                .setStyle('PRIMARY')
        )

        await Promise.all(channelIds.map(async (channelId: string) => {
            const [channel] = await handle(client.channels.fetch(channelId))
            if (!(channel instanceof TextChannel)) {
                return null
            }
            const [message] = await handle(channel.send({ embeds: [teamEmbed], components: [challengeTeamRow] }))
            return message ? { channelId: message.channelId, messageId: message.id } : null
        }))
            .then(notificationsMessages => {
                lineupQueue.notificationMessages = notificationsMessages.filter(notEmpty)
            })
            .catch(console.error)
            .finally(() => lineupQueue.save())

        return lineupQueue
    }


    async leaveQueue(client: Client, lineupQueue: ILineupQueue): Promise<void> {
        if (lineupQueue.lineup.isMixOrCaptains()) {
            return
        }

        await Promise.all(lineupQueue.notificationMessages.map(async (notificationMessage) => {
            const channel = await client.channels.fetch(notificationMessage.channelId) as TextChannel
            handle(channel.messages.delete(notificationMessage.messageId))
        }))
            .catch(console.error)
            .finally(() => this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId))

        await this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId)
    }


    async challenge(interaction: ButtonInteraction | SelectMenuInteraction, lineupQueueIdToChallenge: string): Promise<void> {
        let lineupQueueToChallenge = await this.findLineupQueueById(lineupQueueIdToChallenge)
        if (!lineupQueueToChallenge) {
            await interaction.reply({ content: "⛔ This team is no longer challenging", ephemeral: true })
            return
        }

        let existingChallenge = await this.findChallengeByChannelId(interaction.channelId)
        if (existingChallenge) {
            await interaction.reply(interactionUtils.createReplyAlreadyChallenging(existingChallenge))
            return
        }

        existingChallenge = await this.findChallengeByChannelId(lineupQueueToChallenge.lineup.channelId)
        if (existingChallenge) {
            await interaction.reply({ content: "⛔ This team is negociating a challenge", ephemeral: true })
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (!this.isUserAllowedToInteractWithMatchmaking(interaction.user.id, lineup)) {
            await interaction.reply({ content: `⛔ You must be in the lineup in order to challenge a team`, ephemeral: true })
            return
        }

        if (!this.isLineupAllowedToJoinQueue(lineup)) {
            await interaction.reply({ content: '⛔ All outfield positions must be filled before challenging a team', ephemeral: true })
            return
        }

        if (lineupQueueToChallenge.lineup.size !== lineup.size) {
            await interaction.reply({ content: `⛔ Your team is configured for ${lineup.size}v${lineup.size} while the team you are trying to challenge is configured for ${lineupQueueToChallenge.lineup.size}v${lineupQueueToChallenge.lineup.size}. Both teams must have the same size to challenge.`, ephemeral: true })
            return
        }

        const duplicatedUsersReply = await this.checkForDuplicatedPlayers(interaction, lineup, lineupQueueToChallenge.lineup)
        if (duplicatedUsersReply) {
            await interaction.reply(duplicatedUsersReply)
            return
        }

        await (interaction.message as Message).edit({ components: [] })
        await interaction.deferReply()

        let lineupQueue = await this.findLineupQueueByChannelId(interaction.channelId) || undefined
        if (!lineupQueue) {
            lineupQueue = await new LineupQueue({ lineup }).save()
        }
        let challenge = new Challenge({
            initiatingUser: {
                id: interaction.user.id,
                name: interaction.user.username,
                mention: interaction.user.toString()
            },
            initiatingTeam: lineupQueue,
            challengedTeam: lineupQueueToChallenge
        })

        let channel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId) as TextChannel
        let challengedMessage = await channel!.send(interactionUtils.createDecideChallengeReply(interaction, challenge) as MessageOptions)
        challenge.challengedMessageId = challengedMessage.id

        await this.reserveLineupQueuesByIds([lineupQueueIdToChallenge, lineupQueue._id.toString()], challenge._id.toString())
        let initiatingMessage = await interaction.editReply(interactionUtils.createCancelChallengeReply(interaction, challenge))
        challenge.initiatingMessageId = initiatingMessage.id

        await challenge.save()

        if (await this.isMixOrCaptainsReadyToStart(lineupQueueToChallenge.lineup)) {
            await this.readyMatch(interaction, challenge, lineup)
        }
    }


    async cancelChallenge(client: Client, user: User, challengeId: string): Promise<void> {
        const challenge = await this.findChallengeById(challengeId)
        if (!challenge) {
            return
        }

        let promises: Array<Promise<any>> = [this.deleteChallengeById(challenge._id.toString()), this.freeLineupQueuesByChallengeId(challenge._id.toString())]

        const [challengedTeamChannel] = await handle(client.channels.fetch(challenge.challengedTeam.lineup.channelId))
        if (challengedTeamChannel?.isText()) {
            if (!challenge.challengedTeam.lineup.isMix()) {
                promises.push(challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] }))
            }
            promises.push(challengedTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ **${teamService.formatTeamName(challenge.initiatingTeam.lineup)}** has cancelled the challenge request`)] }))
        }

        const [initiatingTeamChannel] = await handle(client.channels.fetch(challenge.initiatingTeam.lineup.channelId))
        if (initiatingTeamChannel?.isText()) {
            promises.push(initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] }))
            promises.push(initiatingTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ ${user} has cancelled the challenge request against **${teamService.formatTeamName(challenge.challengedTeam.lineup)}**`)] }))
        }

        await Promise.all(promises)
    }


    async checkIfAutoSearch(client: Client, user: User, lineup: ILineup): Promise<AutoSearchResult> {
        const lineupQueue = await this.findLineupQueueByChannelId(lineup.channelId) || undefined
        let autoSearchResult = { joinedQueue: false, leftQueue: false, cancelledChallenge: false, updatedLineupQueue: lineupQueue }

        if (lineup.isMixOrCaptains()) {
            return autoSearchResult
        }

        if (lineup.autoSearch === true && this.isLineupAllowedToJoinQueue(lineup) && !lineupQueue) {
            autoSearchResult.updatedLineupQueue = await this.joinQueue(client, user, lineup)
            autoSearchResult.joinedQueue = true
            return autoSearchResult
        }

        if (!this.isLineupAllowedToJoinQueue(lineup)) {
            const challenge = await this.findChallengeByChannelId(lineup.channelId)

            if (challenge) {
                await this.cancelChallenge(client, user, challenge._id.toString())
                autoSearchResult.cancelledChallenge = true
            }

            if (lineupQueue) {
                await this.leaveQueue(client, lineupQueue)
                autoSearchResult.updatedLineupQueue = undefined
                autoSearchResult.leftQueue = true
            }
        }

        return autoSearchResult
    }

    isUserAllowedToInteractWithMatchmaking(userId: string, lineup: ILineup): boolean {
        return lineup.roles.some(role => role.user?.id === userId);
    }

    async isMixOrCaptainsReadyToStart(lineup: ILineup): Promise<boolean> {
        if (lineup.isCaptains()) {
            return this.isLineupAllowedToJoinQueue(lineup)
        }

        const challenge = await this.findChallengeByChannelId(lineup.channelId)

        if (challenge && challenge.challengedTeam.lineup.isMix()) {
            const initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
            const mixTeamLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)

            const missingRolesForTeam = initiatingTeamLineup!.roles.filter(role => role.user == null)
            const missingRolesForMix = mixTeamLineup!.roles.filter(role => role.lineupNumber === 1).filter(role => role.user == null)
            const allMissingRoles = missingRolesForMix.concat(missingRolesForTeam)

            return allMissingRoles.length == 0 || (lineup.size > 3 && (allMissingRoles.length == 1 && allMissingRoles[0].name.includes('GK')))
        }

        if (!challenge && lineup.isMix()) {
            return this.isLineupAllowedToJoinQueue(lineup)
        }

        return false
    }

    async checkForDuplicatedPlayers(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, firstLineup: ILineup, secondLineup?: ILineup): Promise<InteractionReplyOptions | null> {
        let firstLineupUsers: IUser[]
        let secondLineupUsers: IUser[]
        if (secondLineup) {
            firstLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(notEmpty)
            secondLineupUsers = secondLineup.roles.map(role => role.user).filter(notEmpty)
        } else {
            firstLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(notEmpty)
            secondLineupUsers = firstLineup.roles.filter(role => role.lineupNumber === 2).map(role => role.user).filter(notEmpty)
        }

        let duplicatedUsers = firstLineupUsers.filter(user =>
            user.id !== MERC_USER_ID &&
            secondLineupUsers.some(t => t.id === user.id)
        )
        if (duplicatedUsers.length > 0) {
            let description = 'The following players are signed in both teams. Please arrange with them before challenging: '
            for (let duplicatedUser of duplicatedUsers) {
                let discordUser = await interaction.client.users.fetch(duplicatedUser.id)
                description += discordUser.toString() + ', '
            }
            description = description.substring(0, description.length - 2)

            const duplicatedUsersEmbed = new MessageEmbed()
                .setColor('#566573')
                .setTitle(`⛔ Some players are signed in both teams !`)
                .setDescription(description)
                .setTimestamp()
                .setFooter({ text: `Author: ${interaction.user.username}` })

            return { embeds: [duplicatedUsersEmbed] }
        }

        return null
    }


    async readyMatch(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, challenge?: IChallenge, mixLineup?: ILineup): Promise<void> {
        const firstLineup = challenge ? (await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId))! : mixLineup!
        const secondLineup = challenge ? (await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId) || undefined) : undefined
        const lobbyHost = challenge ? await interaction.client.users.fetch(challenge.initiatingUser.id) : interaction.user
        const lobbyName = challenge
            ? `${teamService.formatTeamName(challenge.initiatingTeam.lineup)} vs. ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`
            : `${teamService.formatTeamName(mixLineup!, true)} #${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const lobbyPassword = Math.random().toString(36).slice(-4)
        const match = await new Match({
            matchId: uuidv4().substring(0, 8),
            schedule: Date.now(),
            lobbyName,
            lobbyPassword,
            firstLineup,
            secondLineup
        }).save()

        if (challenge) {
            await this.deleteChallengeById(challenge._id.toString())
            await this.freeLineupQueuesByChallengeId(challenge._id.toString())
        }

        let matchReadyPromises = []
        matchReadyPromises.push(this.notifyLineupForMatchReady(interaction, match, lobbyHost, firstLineup, secondLineup))
        if (secondLineup) {
            matchReadyPromises.push(this.notifyLineupForMatchReady(interaction, match, lobbyHost, secondLineup, firstLineup))
        }
        await Promise.all(matchReadyPromises)

        if (challenge) {
            const initiatingTeamUsers = firstLineup.roles.map(role => role.user).filter(notEmpty)
            const nonNullSecondLineup = secondLineup!
            const challengedTeamUsers = nonNullSecondLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(notEmpty)

            let promises = []
            promises.push(new Promise<void>(async (resolve, reject) => {
                await this.leaveQueue(interaction.client, challenge.initiatingTeam)
                const newInitiatingTeamLineup = (await teamService.clearLineup(firstLineup.channelId))!
                const reply = await interactionUtils.createReplyForLineup(interaction, newInitiatingTeamLineup) as MessageOptions
                const initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId) as TextChannel
                await initiatingTeamChannel.send(reply)
                await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                resolve()
            }))
            promises.push(new Promise<void>(async (resolve, reject) => {
                if (nonNullSecondLineup.isMix()) {
                    await teamService.clearLineup(nonNullSecondLineup.channelId, [1, 2])
                    await this.clearLineupQueue(challenge.challengedTeam.lineup.channelId, [1, 2])
                    let rolesInFirstLineup = nonNullSecondLineup.roles.filter(role => role.lineupNumber === 1)
                    let rolesInSecondLineup = nonNullSecondLineup.roles.filter(role => role.lineupNumber === 2)
                    rolesInFirstLineup.forEach(role => { role.user = undefined; role.lineupNumber = 2 })
                    rolesInSecondLineup.forEach(role => role.lineupNumber = 1)
                    const newRoles = rolesInFirstLineup.concat(rolesInSecondLineup)
                    const newChallengedTeamLineup = (await teamService.updateLineupRoles(nonNullSecondLineup.channelId, newRoles))!
                    await this.updateLineupQueueRoles(nonNullSecondLineup.channelId, newRoles)
                    const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup) as MessageOptions
                    const challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId) as TextChannel
                    await challengedTeamChannel.send(reply)
                } else {
                    await this.leaveQueue(interaction.client, challenge.challengedTeam)
                    const newChallengedTeamLineup = (await teamService.clearLineup(nonNullSecondLineup.channelId))!
                    const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup) as MessageOptions
                    await interaction.channel?.send(reply)
                }
                resolve()
            }))
            await Promise.all(promises)

            await statsService.updateStats(interaction, challenge.initiatingTeam.lineup.team.region, challenge.initiatingTeam.lineup.size, initiatingTeamUsers.map(user => user.id))
            await statsService.updateStats(interaction, challenge.challengedTeam.lineup.team.region, challenge.challengedTeam.lineup.size, challengedTeamUsers.map(user => user.id))
        }
        else { //This is a mix vs mix match  
            await teamService.clearLineup(mixLineup!.channelId, [1, 2])
            const allUsers = mixLineup!.roles.map(role => role.user).filter(notEmpty)
            const newMixLineup = teamService.createLineup(interaction.channelId, mixLineup!.size, mixLineup!.name, mixLineup!.autoSearch, mixLineup!.team, mixLineup!.type, mixLineup!.visibility)
            const reply = await interactionUtils.createReplyForLineup(interaction, newMixLineup) as MessageOptions
            await interaction.channel?.send(reply)
            await this.clearLineupQueue(mixLineup!.channelId, [1, 2])
            await statsService.updateStats(interaction, mixLineup!.team.region, mixLineup!.size, allUsers.map(user => user.id))
        }
    }


    async findTwoMostRelevantCaptains(userIds: string[]): Promise<IStats[]> {
        let pipeline = <any>[]
        pipeline.push(
            {
                $match: { 'userId': { $in: userIds } }
            }
        )

        pipeline = pipeline.concat([
            {
                $group: {
                    _id: '$userId',
                    numberOfGames: {
                        $sum: '$numberOfGames',
                    }
                }
            },
            {
                $sort: { 'numberOfGames': -1 },
            },
            {
                $limit: 4
            },
            {
                $sample: {
                    size: 4
                }
            }
        ])

        return Stats.aggregate(pipeline)
    }


    async findMatchByMatchId(matchId: string): Promise<IMatch | null> {
        return Match.findOne({ matchId })
    }


    async addSubToMatch(matchId: string, sub: ISub): Promise<UpdateWriteOpResult> {
        return Match.updateOne(
            { matchId },
            {
                "$push": {
                    "subs": sub
                }
            }
        )
    }

    async removeUserFromAllLineupQueues(userId: string): Promise<UpdateWriteOpResult> {
        return LineupQueue.updateMany({ 'lineup.roles.user.id': userId }, { $set: { "lineup.roles.$.user": null } })
    }

    private async freeLineupQueuesByChallengeIds(challengeIds: any): Promise<UpdateWriteOpResult | void> {
        if (challengeIds.length > 0) {
            return LineupQueue.updateMany({ 'challengeId': { $in: challengeIds } }, { challengeId: null })
        }
    }

    private async enhanceWithDiscordUsers(client: Client, roles: IRole[]): Promise<RoleWithDiscordUser[]> {
        const promises = roles.map(async role => {
            if (!role.user || role.user.id === MERC_USER_ID) {
                return { role }
            }

            const [discordUser] = await handle(client.users.fetch(role.user.id))
            return {
                role,
                discordUser
            }
        })

        return Promise.all(promises)
    }

    private async notifyUsersForMatchReady(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, match: IMatch, lobbyHost: User, rolesWithDiscordUsers: RoleWithDiscordUser[], opponentLineup?: ILineup): Promise<void> {
        let discordUsersWithoutDm: User[] = []

        const promises = rolesWithDiscordUsers.map(async role => {
            if (!role.discordUser) {
                return
            }

            let embeds = []
            embeds.push(new MessageEmbed()
                .setColor('#6aa84f')
                .setTitle(`⚽ Match Ready ⚽`)
                .setDescription(`**Please join the match as soon as possible**\nThe lobby can be found in the **"Custom Lobbies"** menu of the game\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***\n\n`)
                .addField('Lobby Name', `${match.lobbyName}`, true)
                .addField('Lobby Password', `${match.lobbyPassword}`, true)
                .addField('Lobby Host', `${lobbyHost.username}`, true)
                .setTimestamp())

            embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(roleWithDiscordUser => roleWithDiscordUser.role.lineupNumber === 1), opponentLineup))
            if (!opponentLineup) {
                embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(roleWithDiscordUser => roleWithDiscordUser.role.lineupNumber === 2), opponentLineup))
            }

            const [message] = await handle(role.discordUser.send({ embeds }))
            if (!message) {
                discordUsersWithoutDm.push(role.discordUser)
            }
        })

        await Promise.all(promises)

        if (discordUsersWithoutDm.length > 0) {
            const embed = new MessageEmbed()
                .setColor('#6aa84f')
                .setTitle('⚠ Some players did not receive the lobby information ⚠')
                .setDescription(discordUsersWithoutDm.join(', '))
                .setTimestamp()
            await interaction.channel?.send({ embeds: [embed] })
        }
    }

    private async notifyLineupsForUsersLeaving(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, rolesWithDiscordUsers: RoleWithDiscordUser[], lineup: ILineup) {
        const promises = rolesWithDiscordUsers
            .map(roleWithDiscordUser => roleWithDiscordUser.discordUser)
            .filter(notEmpty)
            .map(async discordUser => {
                const channelIds = await teamService.findAllLineupChannelIdsByUserId(discordUser.id, [lineup.channelId])
                if (channelIds.length > 0) {
                    await this.removeUserFromAllLineupQueues(discordUser.id)
                    await teamService.removeUserFromLineupsByChannelIds(discordUser.id, channelIds)
                    await Promise.all(channelIds.map(async (channelId: string) => {
                        await teamService.notifyChannelForUserLeaving(interaction.client, discordUser, channelId, `⚠ ${discordUser} went to play another match with **${teamService.formatTeamName(lineup)}**`)
                    }))
                }
            })

        return Promise.all(promises)
    }

    private async notifyLineupChannelForMatchReady(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, match: IMatch, lobbyHost: User, rolesWithDiscordUsers: RoleWithDiscordUser[], lineup: ILineup, opponentLineup?: ILineup) {
        let embeds = []

        embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(rolesWithDiscordUsers => rolesWithDiscordUsers.role.lineupNumber === 1), opponentLineup))
        if (!opponentLineup) {
            embeds.push(interactionUtils.createLineupEmbed(rolesWithDiscordUsers.filter(roleWithDiscordUser => roleWithDiscordUser.role.lineupNumber === 2), opponentLineup))
        }

        const matchReadyEmbed = new MessageEmbed()
            .setColor('#6aa84f')
            .setTitle(`${opponentLineup ? '⚽ Challenge Accepted ⚽' : '⚽ Match Ready ⚽'}`)
            .setTimestamp()
            .setDescription(`**${lobbyHost.username}** is responsible of creating the lobby\nPlease check your direct messages to find the lobby information\n\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***`)
        embeds.push(matchReadyEmbed)

        const channel = await interaction.client.channels.fetch(lineup.channelId) as TextChannel
        await channel.send({ embeds })
    }

    private async notifyLineupForMatchReady(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, match: IMatch, lobbyHost: User, lineup: ILineup, opponentLineup?: ILineup) {
        const rolesWithDiscordUsers = await this.enhanceWithDiscordUsers(
            interaction.client,
            opponentLineup
                ? lineup.roles.filter(role => role.lineupNumber === 1)
                : lineup.roles)

        let promises = []
        promises.push(this.notifyLineupChannelForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, lineup, opponentLineup))
        promises.push(this.notifyUsersForMatchReady(interaction, match, lobbyHost, rolesWithDiscordUsers, opponentLineup))
        promises.push(this.notifyLineupsForUsersLeaving(interaction, rolesWithDiscordUsers, lineup))
        return Promise.all(promises)
    }
}

export interface AutoSearchResult {
    joinedQueue: boolean,
    leftQueue: boolean,
    cancelledChallenge: boolean,
    updatedLineupQueue?: ILineupQueue
}

export interface RoleWithDiscordUser {
    role: IRole
    discordUser?: User
}

