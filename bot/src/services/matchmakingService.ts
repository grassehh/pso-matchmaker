import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Client, CommandInteraction, EmbedBuilder, Interaction, InteractionReplyOptions, Message, MessageOptions, SelectMenuBuilder, SelectMenuInteraction, TextChannel, User } from "discord.js";
import { DeleteResult } from "mongodb";
import { UpdateWriteOpResult } from "mongoose";
import { Elo } from "simple-elo-rating";
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_RATING, MERC_USER_ID } from "../constants";
import { Challenge, IChallenge, ILineup, ILineupMatchResult, ILineupQueue, IMatch, IRole, IStats, ISub, IUser, Lineup, LineupQueue, Match, Stats } from "../mongoSchema";
import { handle, notEmpty } from "../utils";
import { interactionUtils } from "./interactionUtils";
import { statsService } from "./statsService";
import { LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM, RankedStats, ROLE_GOAL_KEEPER, teamService } from "./teamService";
const ZScore = require("math-z-score");

export enum MatchResult {
    WIN = 1,
    DRAW = 0,
    LOSS = -1
}

export namespace MatchResultType {
    export function toString(matchResultType: MatchResult) {
        switch (matchResultType) {
            case MatchResult.WIN:
                return "WIN"
            case MatchResult.DRAW:
                return "DRAW"
            case MatchResult.LOSS:
                return "LOSS"
        }
    }
}

class MatchmakingService {
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


    async findAvailableLineupQueues(region: string, channelId: string, lineupSize: number, guildId: string, ranked: boolean): Promise<ILineupQueue[]> {
        let match: any = {
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

        if (ranked) {
            match.ranked = true
        }

        return LineupQueue.find(match)
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


    async joinQueue(lineup: ILineup, ranked: boolean): Promise<ILineupQueue> {
        const lineupQueue = new LineupQueue({ lineup, ranked })
        // const channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)

        //FIXME This eventually causes rate limit exceeding
        /*let description = `**${teamService.formatTeamName(lineup)}**`
        const teamEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle('A team is looking for a match !')
            .setTimestamp()
        description += `\n${lineup.roles.filter(role => role.user != null).length} players signed`
        if (!teamService.hasGkSigned(lineupQueue.lineup)) {
            description += ' **(no GK)**'
        }
        description += `\n\n*Contact ${user} for more information*`
        teamEmbed.setDescription(description)

        const challengeTeamRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
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
            */

        lineupQueue.save()
        return lineupQueue
    }


    async leaveQueue(lineupQueue: ILineupQueue): Promise<void> {
        if (lineupQueue.lineup.isMixOrCaptains()) {
            return
        }

        /*
        await Promise.all(lineupQueue.notificationMessages.map(async (notificationMessage) => {
            const channel = await client.channels.fetch(notificationMessage.channelId) as TextChannel
            handle(channel.messages.delete(notificationMessage.messageId))
        }))
            .catch(console.error)
            */

        await this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId)
    }

    async listChallenges(interaction: ButtonInteraction | CommandInteraction, lineup: ILineup, ranked: boolean): Promise<void> {
        await interaction.deferReply()
        let lineupQueues = await matchmakingService.findAvailableLineupQueues(lineup.team.region, lineup.channelId, lineup.size, lineup.team.guildId, ranked)
        if (lineupQueues.length === 0) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#566573')
                        .setDescription(`No Team is currently searching for a ${lineup.size}v${lineup.size} match 😪`)
                ]
            })
            return
        }

        const gameMode = ranked ? 'Ranked' : 'Casual'
        const teamLineupsEmbed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle(`Teams (${gameMode})`)
        const teamLineupQueues = lineupQueues.filter((lineupQueue: ILineupQueue) => !lineupQueue.lineup.isMix())
        let teamsActionComponents: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = []
        if (teamLineupQueues.length === 0) {
            teamLineupsEmbed.setDescription(`No Team available for ${lineup.size}v${lineup.size}`)
        } else {
            let teamLineupEmbedDescription = ''
            for (let lineupQueue of teamLineupQueues) {
                teamLineupEmbedDescription += `${teamService.formatTeamName(lineupQueue.lineup, false, true)}\n`
                teamLineupEmbedDescription += lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    teamLineupEmbedDescription += ' **(no GK)**'
                }
                teamLineupEmbedDescription += '\n\n'
            }
            teamLineupsEmbed.setDescription(teamLineupEmbedDescription)
            let teamsActionRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>()
            if (teamLineupQueues.length < 6) {
                for (let lineupQueue of teamLineupQueues) {
                    teamsActionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`challenge_${lineupQueue._id}`)
                            .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                            .setStyle(ButtonStyle.Primary)
                    )
                }
            } else {
                const challengesSelectMenu = new SelectMenuBuilder()
                    .setCustomId(`select_challenge`)
                    .setPlaceholder('Select a Team to challenge')
                for (let lineupQueue of teamLineupQueues) {
                    challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue._id.toString() }])
                }
                teamsActionRow.addComponents(challengesSelectMenu)
            }
            teamsActionComponents = [teamsActionRow]
        }

        const mixLineupsEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`Mixes (${gameMode})`)
        const mixLineupQueues = lineupQueues.filter((lineupQueue: ILineupQueue) => lineupQueue.lineup.isMix())
        let mixesActionComponents: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = []
        if (mixLineupQueues.length === 0) {
            mixLineupsEmbed.setDescription(`No Mix available for ${lineup.size}v${lineup.size}`)
        } else {
            for (let lineupQueue of mixLineupQueues) {
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no GK)**'
                }
                mixLineupsEmbed.addFields([{ name: `${teamService.formatTeamName(lineupQueue.lineup, false)} *(${lineupQueue.lineup.computePlayersAverageRating()})*`, value: lineupFieldValue }])
            }
            let mixesActionRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>()
            if (mixLineupQueues.length < 6) {
                for (let lineupQueue of mixLineupQueues) {
                    mixesActionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`challenge_${lineupQueue._id}`)
                            .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                            .setStyle(ButtonStyle.Secondary)
                    )
                }
            } else {
                const challengesSelectMenu = new SelectMenuBuilder()
                    .setCustomId(`select_challenge`)
                    .setPlaceholder('Select a Mix to challenge')
                for (let lineupQueue of mixLineupQueues) {
                    challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue._id.toString() }])
                }
                mixesActionRow.addComponents(challengesSelectMenu)
            }
            mixesActionComponents = [mixesActionRow]
        }


        await interaction.channel?.send({ embeds: [mixLineupsEmbed], components: mixesActionComponents })
        await interaction.editReply({ embeds: [teamLineupsEmbed], components: teamsActionComponents })
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

        if (lineupQueueToChallenge.ranked && !lineup.isAllowedToPlayRanked()) {
            await interaction.reply({ content: `⛔ You are not allowed to play ranked matches`, ephemeral: true })
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

        const lineupHasAnyMerc = lineup.roles.some(role => role.user?.id === MERC_USER_ID)
        if (lineupHasAnyMerc && lineupQueueToChallenge.ranked) {
            await interaction.reply({ content: "⛔ You can't challenge a ranked team with a merc signed", ephemeral: true })
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
            lineupQueue = await new LineupQueue({ lineup, ranked: lineupQueueToChallenge.ranked }).save()
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
        if (challengedTeamChannel?.type === ChannelType.GuildText) {
            if (!challenge.challengedTeam.lineup.isMix()) {
                promises.push(challengedTeamChannel.messages.edit(challenge.challengedMessageId, { components: [] }))
            }
            promises.push(challengedTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ **${teamService.formatTeamName(challenge.initiatingTeam.lineup)}** has cancelled the challenge request`)] }))
        }

        const [initiatingTeamChannel] = await handle(client.channels.fetch(challenge.initiatingTeam.lineup.channelId))
        if (initiatingTeamChannel?.type === ChannelType.GuildText) {
            promises.push(initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] }))
            promises.push(initiatingTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(user, `❌ ${user} has cancelled the challenge request against ${teamService.formatTeamName(challenge.challengedTeam.lineup)}`)] }))
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
            autoSearchResult.updatedLineupQueue = await this.joinQueue(lineup, lineup.isAllowedToPlayRanked())
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
                await this.leaveQueue(lineupQueue)
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

            const duplicatedUsersEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle(`⛔ Some players are signed in both teams !`)
                .setDescription(description)
                .setTimestamp()
                .setFooter({ text: `Author: ${interaction.user.username}` })

            return { embeds: [duplicatedUsersEmbed] }
        }

        return null
    }


    async readyMatch(interaction: Interaction, challenge?: IChallenge, mixLineup?: ILineup): Promise<void> {
        let initiatingLineup: ILineup, challengedLineup: ILineup
        let ranked
        if (challenge) {
            initiatingLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId) as ILineup
            initiatingLineup = Lineup.hydrate((initiatingLineup as any).toObject())
            initiatingLineup.roles = initiatingLineup.roles.filter(role => role.lineupNumber === 1) as IRole[]
            challengedLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId) as ILineup
            challengedLineup = Lineup.hydrate((challengedLineup as any).toObject())
            challengedLineup.roles = challengedLineup.roles.filter(role => role.lineupNumber === 1) as IRole[]
            ranked = challenge.initiatingTeam.ranked && challenge.challengedTeam.ranked
            await Promise.all([
                await this.deleteChallengeById(challenge._id.toString()),
                await this.freeLineupQueuesByChallengeId(challenge._id.toString())
            ])
        } else {
            initiatingLineup = Lineup.hydrate((mixLineup as any).toObject())
            initiatingLineup.roles = initiatingLineup.roles.filter(role => role.lineupNumber === 1) as IRole[]
            initiatingLineup.name = "Red Team"
            challengedLineup = Lineup.hydrate((mixLineup as any).toObject())
            challengedLineup.roles = challengedLineup.roles.filter(role => role.lineupNumber === 2) as IRole[]
            challengedLineup.roles.filter(role => role.lineupNumber === 2).forEach(role => role.lineupNumber = 1)
            challengedLineup.name = "Blue Team"
            ranked = mixLineup!.allowRanked
        }

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
            firstLineup: initiatingLineup,
            secondLineup: challengedLineup,
            ranked
        }).save()

        await this.notifyForMatchReady(interaction, match, lobbyHost, initiatingLineup, challengedLineup)
        await this.sendMatchResultVoteMessage(interaction, match)

        if (challenge) {
            const initiatingTeamUsers = initiatingLineup.roles.map(role => role.user).filter(notEmpty)
            const nonNullChallengedLineup = challengedLineup!
            const challengedTeamUsers = nonNullChallengedLineup.roles.filter(role => role.lineupNumber === 1).map(role => role.user).filter(notEmpty)

            let promises = []
            promises.push(new Promise<void>(async (resolve) => {
                await this.leaveQueue(challenge.initiatingTeam)
                const newInitiatingTeamLineup = initiatingLineup.moveAllBenchToLineup()
                newInitiatingTeamLineup.lastMatchDate = match.schedule
                await teamService.upsertLineup(newInitiatingTeamLineup)
                await teamService.updateTeamLastMatchDateByGuildId(newInitiatingTeamLineup.team.guildId, match.schedule)
                const reply = await interactionUtils.createReplyForLineup(interaction, newInitiatingTeamLineup) as MessageOptions
                const initiatingTeamChannel = await interaction.client.channels.fetch(challenge.initiatingTeam.lineup.channelId) as TextChannel
                await initiatingTeamChannel.send(reply)
                await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                resolve()
            }))
            promises.push(new Promise<void>(async (resolve) => {
                if (nonNullChallengedLineup.isMix()) {
                    let newMixLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId) as ILineup
                    newMixLineup = newMixLineup.moveAllBenchToLineup()
                    newMixLineup.roles.filter(role => role.lineupNumber === 2 && role.user)
                        .forEach(roleInSecondLineup => {
                            const roleInFirstLineup = newMixLineup.roles.find(r => r.lineupNumber === 1 && r.name === roleInSecondLineup.name)!!
                            if (!roleInFirstLineup.user) {
                                roleInFirstLineup.user = roleInSecondLineup.user
                                roleInSecondLineup.user = undefined
                            }
                        })
                    newMixLineup = newMixLineup.moveAllBenchToLineup(2, false)
                    newMixLineup.lastMatchDate = match.schedule
                    await teamService.upsertLineup(newMixLineup)
                    await teamService.updateTeamLastMatchDateByGuildId(newMixLineup.team.guildId, match.schedule)
                    await this.updateLineupQueueRoles(nonNullChallengedLineup.channelId, newMixLineup.roles)
                    const reply = await interactionUtils.createReplyForLineup(interaction, newMixLineup) as MessageOptions
                    const challengedTeamChannel = await interaction.client.channels.fetch(challenge.challengedTeam.lineup.channelId) as TextChannel
                    await challengedTeamChannel.send(reply)
                } else {
                    await this.leaveQueue(challenge.challengedTeam)
                    const newChallengedTeamLineup = nonNullChallengedLineup.moveAllBenchToLineup()
                    await teamService.upsertLineup(newChallengedTeamLineup)
                    const reply = await interactionUtils.createReplyForLineup(interaction, newChallengedTeamLineup) as MessageOptions
                    await interaction.channel?.send(reply)
                }
                resolve()
            }))
            await Promise.all(promises)

            await Promise.all([
                statsService.updateStats(interaction, challenge.initiatingTeam.lineup.team.region, challenge.initiatingTeam.lineup.size, initiatingTeamUsers.map(user => user.id)),
                statsService.updateStats(interaction, challenge.challengedTeam.lineup.team.region, challenge.challengedTeam.lineup.size, challengedTeamUsers.map(user => user.id))
            ])
        }
        else { //This is a mix vs mix match     
            const allUsers = mixLineup!.roles.map(role => role.user).filter(notEmpty)
            let newMixLineup = mixLineup!
            if (newMixLineup.isCaptains()) {
                newMixLineup = teamService.createLineup(newMixLineup.channelId, newMixLineup.size, "", false, newMixLineup.allowRanked, newMixLineup.team, LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM)
            } else {
                newMixLineup = newMixLineup.moveAllBenchToLineup(1).moveAllBenchToLineup(2)
            }
            newMixLineup.lastMatchDate = match.schedule
            await teamService.upsertLineup(newMixLineup)
            await teamService.updateTeamLastMatchDateByGuildId(newMixLineup.team.guildId, match.schedule)
            const reply = await interactionUtils.createReplyForLineup(interaction, newMixLineup) as MessageOptions
            await interaction.channel?.send(reply)
            await this.updateLineupQueueRoles(newMixLineup.channelId, newMixLineup.roles)
            await statsService.updateStats(interaction, newMixLineup.team.region, newMixLineup.size, allUsers.map(user => user.id))
        }
    }

    async sendMatchResultVoteMessage(interaction: BaseInteraction, match: IMatch): Promise<void> {
        if (!match.ranked) {
            return
        }

        let promises = []
        promises.push(new Promise<void>(async (resolve) => {
            const firstLineupUserId = await this.findHighestRatedUserId(match.firstLineup)
            const firstLineupUser = await interaction.client.users.fetch(firstLineupUserId)
            const firstLineupChannel = await interaction.client.channels.fetch(match.firstLineup.channelId) as TextChannel
            const message = await firstLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, firstLineupUser))
            handle(firstLineupUser.send(interactionUtils.createMatchResultVoteUserMessage(message)))
            resolve()
        }))
        promises.push(new Promise<void>(async (resolve) => {
            const secondLineupUserId = await this.findHighestRatedUserId(match.secondLineup)
            const secondLineupUser = await interaction.client.users.fetch(secondLineupUserId)
            const secondLineupChannel = await interaction.client.channels.fetch(match.secondLineup.channelId) as TextChannel
            const message = await secondLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, secondLineupUser))
            handle(secondLineupUser.send(interactionUtils.createMatchResultVoteUserMessage(message)))
            resolve()
        }))

        await Promise.all(promises)
    }

    async findHighestRatedUserId(lineup: ILineup): Promise<string> {
        const userIds: string[] = lineup.roles.map(role => role.user?.id).filter(id => id !== MERC_USER_ID).filter(notEmpty)

        let pipeline = <any>[]
        pipeline.push(
            {
                $match: { 'userId': { $in: userIds }, 'region': lineup.team.region }
            }
        )

        pipeline = pipeline.concat([
            {
                $group: {
                    _id: '$userId'
                }
            },
            {
                $sort: { 'rating': -1 },
            },
            {
                $limit: 1
            }
        ])

        const stats: IStats[] = await Stats.aggregate(pipeline)

        if (stats.length === 0) {
            return userIds[0]
        }

        return (stats[0] as any)._id
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
                    rating: {
                        $avg: '$mixCaptainsRating',
                    }
                }
            },
            {
                $sort: { 'rating': -1 },
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

    async updateMatchResult(matchId: string, lineupToUpdate: number, lineupResult: ILineupMatchResult): Promise<IMatch | null> {
        return Match.findOneAndUpdate(
            { matchId },
            { "$set": lineupToUpdate === 1 ? { "result.firstLineup": lineupResult } : { "result.secondLineup": lineupResult } },
            { new: true }
        )
    }

    async resetMatchResult(matchId: string): Promise<UpdateWriteOpResult> {
        return Match.updateOne(
            { matchId },
            { "$set": { "result": {} } }
        )
    }

    async updateRatings(match: IMatch): Promise<void> {
        await Promise.all([
            this.updateTeamsRating(match),
            this.updatePlayersRating(match)
        ])
    }

    private async updateTeamsRating(match: IMatch): Promise<void> {
        let elo = new Elo()
            .playerA(match.firstLineup.team.rating)
            .playerB(match.secondLineup.team.rating)
        if (match.result.firstLineup!.result === MatchResult.DRAW) {
            elo.setDraw()
        } else if (match.result.firstLineup!.result === MatchResult.WIN) {
            elo.setWinnerA()
        } else {
            elo.setWinnerB()
        }

        const [firstLineupNewRating, secondLineupNewRating] = elo.calculate().getResults()
        if (match.firstLineup.isTeam()) {
            await teamService.updateTeamRating(match.firstLineup.team.guildId, firstLineupNewRating)
        }
        if (match.secondLineup.isTeam()) {
            await teamService.updateTeamRating(match.secondLineup.team.guildId, secondLineupNewRating)
        }
    }

    private async updatePlayersRating(match: IMatch): Promise<void> {
        const firstLineupRating = await new LineupRating(match.firstLineup, match.secondLineup, match.result.firstLineup!.result).init()
        const secondLineupRating = await new LineupRating(match.secondLineup, match.firstLineup, match.result.secondLineup!.result).init()

        match.firstLineup.roles.map(role => role.user).filter(notEmpty).forEach(async user => {
            const newRating = firstLineupRating.computeNewPlayerRating(user.id, secondLineupRating.lineupRatingAverage!)
            if (newRating) {
                await statsService.updatePlayerRating(user.id, match.firstLineup.team.region, newRating)
            }
        })

        match.secondLineup.roles.map(role => role.user).filter(notEmpty).forEach(async user => {
            const newRating = secondLineupRating.computeNewPlayerRating(user.id, firstLineupRating.lineupRatingAverage!)
            if (newRating) {
                await statsService.updatePlayerRating(user.id, match.secondLineup.team.region, newRating)
            }
        })
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

    private async notifyUsersForMatchReady(interaction: Interaction, match: IMatch, lobbyHost: User, lineup: ILineup, lineupRoles: RoleWithDiscordUser[], opponentLineup: ILineup, opponentLineupRoles: RoleWithDiscordUser[]): Promise<void> {
        let discordUsersWithoutDm: User[] = []

        const promises = lineupRoles.map(async role => {
            if (!role.discordUser) {
                return
            }

            let embeds = []
            embeds.push(new EmbedBuilder()
                .setColor('#6aa84f')
                .setTitle(`⚽ Match Ready ⚽`)
                .setDescription(`**Please join the match as soon as possible**\nThe lobby can be found in the **"Custom Lobbies"** menu of the game\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***\n\n`)
                .addFields([
                    { name: 'Lobby Name', value: `${match.lobbyName}`, inline: true },
                    { name: 'Lobby Password', value: `${match.lobbyPassword}`, inline: true },
                    { name: 'Lobby Host', value: `${lobbyHost.username}`, inline: true }
                ])
                .setTimestamp()
            )

            embeds.push(interactionUtils.createLineupEmbed(lineupRoles, lineup))
            embeds.push(interactionUtils.createLineupEmbed(opponentLineupRoles, opponentLineup))

            const [message] = await handle(role.discordUser.send({ embeds }))
            if (!message) {
                discordUsersWithoutDm.push(role.discordUser)
            }
        })

        await Promise.all(promises)

        if (discordUsersWithoutDm.length > 0) {
            const embed = new EmbedBuilder()
                .setColor('#6aa84f')
                .setTitle('⚠ Some players did not receive the lobby information ⚠')
                .setDescription(discordUsersWithoutDm.join(', '))
                .setTimestamp()
            await interaction.channel?.send({ embeds: [embed] })
        }
    }

    private async notifyLineupsForUsersLeaving(interaction: Interaction, lineup: ILineup, rolesWithDiscordUsers: RoleWithDiscordUser[]) {
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

    private async notifyLineupChannelForMatchReady(interaction: Interaction, match: IMatch, lobbyHost: User, lineup: ILineup, lineupRoles: RoleWithDiscordUser[], opponentLineup: ILineup, opponentLineupRoles: RoleWithDiscordUser[]) {
        let embeds = []

        embeds.push(interactionUtils.createLineupEmbed(lineupRoles, lineup))
        embeds.push(interactionUtils.createLineupEmbed(opponentLineupRoles, opponentLineup))

        const matchReadyEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle(`${opponentLineup ? '⚽ Challenge Accepted ⚽' : '⚽ Match Ready ⚽'}`)
            .setTimestamp()
            .setDescription(`**${lobbyHost.username}** is responsible of creating the lobby\nPlease check your direct messages to find the lobby information\n\n*If you need a sub, please type **/request_sub** followed by the match id **${match.matchId}***`)
        embeds.push(matchReadyEmbed)

        const channel = await interaction.client.channels.fetch(lineup.channelId) as TextChannel
        await channel.send({ embeds })
    }

    private async notifyForMatchReady(interaction: Interaction, match: IMatch, lobbyHost: User, firstLineup: ILineup, secondLineup: ILineup) {
        const firstLineupRoles = await this.enhanceWithDiscordUsers(interaction.client, firstLineup.roles)
        const secondLineupRoles = await this.enhanceWithDiscordUsers(interaction.client, secondLineup.roles)
        let promises = []
        promises.push(this.notifyUsersForMatchReady(interaction, match, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
        promises.push(this.notifyUsersForMatchReady(interaction, match, lobbyHost, secondLineup, secondLineupRoles, firstLineup, firstLineupRoles))
        promises.push(this.notifyLineupsForUsersLeaving(interaction, firstLineup, firstLineupRoles))
        promises.push(this.notifyLineupsForUsersLeaving(interaction, secondLineup, secondLineupRoles))
        if (firstLineup.isMixOrCaptains() && secondLineup.isMixOrCaptains()) {
            promises.push(this.notifyLineupChannelForMatchReady(interaction, match, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
        } else {
            promises.push(this.notifyLineupChannelForMatchReady(interaction, match, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
            promises.push(this.notifyLineupChannelForMatchReady(interaction, match, lobbyHost, secondLineup, secondLineupRoles, firstLineup, firstLineupRoles))
        }
        return Promise.all(promises)
    }
}

export const matchmakingService = new MatchmakingService()

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

class LineupRating {
    private readonly lineup: ILineup
    private readonly opponentLineup: ILineup
    private readonly zscore: typeof ZScore
    private readonly rankedStatsByUserId: Map<string, RankedStats> = new Map()
    private readonly matchResult: MatchResult
    private readonly kFactorPerNumberOfGames: Map<string, number> = new Map().set("25", 30).set("250", 20).set("800", 10)
    lineupRatingAverage?: number

    constructor(lineup: ILineup, opponentLineup: ILineup, matchResult: MatchResult) {
        this.lineup = lineup
        this.opponentLineup = opponentLineup
        this.zscore = new ZScore()
        this.matchResult = matchResult
    }

    public async init() {
        let roles = this.lineup.getNonMecSignedRoles()
        const lineupHasGk = roles.some(role => role.type === ROLE_GOAL_KEEPER)
        const opponentLineupHasGk = this.opponentLineup.getNonMecSignedRoles().some(role => role.type === ROLE_GOAL_KEEPER)
        if (!lineupHasGk || !opponentLineupHasGk) {
            roles = roles.filter(role => role.type !== ROLE_GOAL_KEEPER)
        }

        await Promise.all(roles.map(async role => {
            let playerStats = await statsService.findUserStats(role.user!.id, this.lineup.team.region)
            if (!playerStats) {
                playerStats = new Stats({
                    userId: role.user?.id,
                    region: this.lineup.team.region,
                    numberOfGames: 0,
                    numberOfRankedGames: 0,
                    numberOfRankedWins: 0,
                    numberOfRankedDraws: 0,
                    numberOfRankedLosses: 0,
                    attackRating: DEFAULT_RATING,
                    midfieldRating: DEFAULT_RATING,
                    defenseRating: DEFAULT_RATING,
                    goalKeeperRating: DEFAULT_RATING,
                    mixCaptainsRating: DEFAULT_RATING
                })
            }

            this.rankedStatsByUserId.set(role.user!.id, {
                role,
                rating: playerStats.getRating(role.type),
                wins: playerStats.numberOfRankedWins,
                draws: playerStats.numberOfRankedDraws,
                losses: playerStats.numberOfRankedLosses
            })
        }))
        const ratings = Array.from(this.rankedStatsByUserId.values()).map(rankedRole => rankedRole.rating)
        this.zscore.setMeanAndDeviationFromDataset(ratings, true)
        const sum = ratings.reduce((a, b) => a + b, 0);
        this.lineupRatingAverage = (sum / ratings.length) || 0;
        return this
    }

    public computeNewPlayerRating(userId: string, opponentLineupRatingAverage: number): RankedStats | null {
        const rankedStats = this.rankedStatsByUserId.get(userId)
        if (!rankedStats) {
            return null
        }

        const matchesPlayed = rankedStats.wins + rankedStats.draws + rankedStats.losses
        const zscore = Math.abs(this.zscore.getZScore(rankedStats.rating)) || 0
        let k = Array.from(this.kFactorPerNumberOfGames.entries()).find(e => matchesPlayed > parseInt(e[0]))?.[1] || 40
        k /= Math.max(1, 0.3 * Math.exp(zscore))

        let elo = new Elo(k)
            .playerA(rankedStats.rating)
            .playerB(opponentLineupRatingAverage)
        if (this.matchResult === MatchResult.DRAW) {
            elo.setDraw()
            rankedStats.draws++
        } else if (this.matchResult === MatchResult.WIN) {
            elo.setWinnerA()
            rankedStats.wins++
        } else {
            elo.setWinnerB()
            rankedStats.losses++
        }

        const newRating = elo.calculate().getResults()[0]

        return { role: rankedStats.role, rating: newRating, wins: rankedStats.wins, losses: rankedStats.losses, draws: rankedStats.draws }
    }
}