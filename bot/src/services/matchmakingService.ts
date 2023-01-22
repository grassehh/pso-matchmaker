import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Client, CommandInteraction, EmbedBuilder, Interaction, InteractionReplyOptions, Message, StringSelectMenuBuilder, AnySelectMenuInteraction, TextChannel, User, SelectMenuComponentOptionData } from "discord.js";
import { DeleteResult } from "mongodb";
import { UpdateWriteOpResult } from "mongoose";
import { Elo } from "simple-elo-rating";
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_RATING } from "../constants";
import { Challenge, IChallenge, ILineup, ILineupQueue, IMatch, IMatchResult, IPlayerStats, IRole, ISub, IUser, Lineup, LineupQueue, Match, PlayerStats, TeamStats } from "../mongoSchema";
import { handle, notEmpty } from "../utils";
import { interactionUtils } from "./interactionUtils";
import { Region, regionService } from "./regionService";
import { statsService } from "./statsService";
import { LINEUP_TYPE_CAPTAINS, LINEUP_TYPE_MIX, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM, RankedStats, ROLE_GOAL_KEEPER, TeamLogoDisplay, teamService } from "./teamService";
const ZScore = require("math-z-score");

export enum MatchResult {
    WIN = 1,
    DRAW = 0,
    LOSS = -1,
    CANCEL = -2
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
            case MatchResult.CANCEL:
                return "CANCELLED"
        }
    }

    export function toEmoji(matchResultType: MatchResult) {
        switch (matchResultType) {
            case MatchResult.WIN:
                return '🟩'
            case MatchResult.DRAW:
                return '🔲'
            case MatchResult.LOSS:
                return '🟥'
            case MatchResult.CANCEL:
                return '❌'
        }
    }
}

class MatchmakingService {
    private readonly MAX_ATTEMPTS_BEFORE_WIDE_SEARCH = 30
    private ratingDifferenceByAttempts = new Map()
        .set(this.MAX_ATTEMPTS_BEFORE_WIDE_SEARCH, -1)
        .set(27, 4450)
        .set(24, 2750)
        .set(21, 1050)
        .set(18, 650)
        .set(15, 400)
        .set(12, 250)
        .set(9, 150)
        .set(6, 100)

    isLineupAllowedToJoinQueue(lineup: ILineup): boolean {
        let numberOfPlayersSigned = lineup.roles.filter(role => role.user).length
        let lineupSize = lineup.isNotTeam() ? lineup.size * 2 : lineup.size
        let numberOfMissingPlayers = lineupSize - numberOfPlayersSigned
        if (lineup.isNotTeam() && !lineup.isCaptains() && lineup.allowRanked) {
            return numberOfMissingPlayers === 0
        }

        let missingRoleName = lineup.roles.find(role => !role.user)?.name || ''
        return numberOfMissingPlayers === 0 || (lineup.size > 3 && (numberOfMissingPlayers === 1 && missingRoleName.includes('GK')))
    }

    async findLatestRankedMatch(userId: string): Promise<IMatch | null> {
        return Match.findOne({
            ranked: true,
            $or: [
                { 'firstLineup.roles.user.id': userId },
                { 'secondLineup.roles.user.id': userId }
            ]
        })
            .sort({ schedule: -1 })
            .limit(1)
    }

    async updateBansListChannel(client: Client): Promise<void> {
        regionService.getAllRegionsData().forEach(async (regionData) => {
            if (regionData.bansListChannelId) {
                const banListEmbeds = await interactionUtils.createBanListEmbeds(client, regionData.guildId)
                const channel = await client.channels.fetch(regionData.bansListChannelId) as TextChannel
                const messages = await channel.messages.fetch({ limit: 1 })
                if (messages.size === 0) {
                    handle(channel.send({ embeds: banListEmbeds }))
                } else {
                    messages.first()?.edit({ embeds: banListEmbeds })
                        .catch(async () => handle(channel.send({ embeds: banListEmbeds })))
                }
            }
        })
    }

    async makeMatches(client: Client): Promise<void> {
        let lineupQueues = await LineupQueue.find(
            {
                'lineup.type': LINEUP_TYPE_TEAM,
                'lineup.autoMatchmaking': true,
                challengeId: null
            })
            .sort({ '_id': 1 })
        if (lineupQueues.length === 0) {
            return
        }

        let i = lineupQueues.length
        while (i--) {
            let lineupQueue = lineupQueues[i]
            const maxRatingDifference = Array.from(this.ratingDifferenceByAttempts.entries()).find(e => lineupQueue.matchmakingAttempts >= parseInt(e[0]))?.[1] || 40
            const match: any = {
                'lineup.channelId': { $ne: lineupQueue.lineup.channelId },
                'lineup.team.region': lineupQueue.lineup.team.region,
                'lineup.autoMatchmaking': true,
                'lineup.type': lineupQueue.lineup.type,
                'lineup.size': lineupQueue.lineup.size,
                ranked: lineupQueue.ranked,
                challengeId: null
            }
            if (!lineupQueue.lineup.hasGkSigned()) {
                match['lineup.roles'] = {
                    $elemMatch: {
                        type: ROLE_GOAL_KEEPER,
                        user: { $ne: null }
                    }
                }
            }

            let challengingLineupQueue = await matchmakingService.findLineupQueueById(lineupQueue._id.toString())
            if (challengingLineupQueue?.challengeId != null) {
                continue
            }
            const lineupQueueToChallenge = await LineupQueue.aggregate([
                {
                    $match: match
                },
                {
                    $project: {
                        _id: 1,
                        lineup: 1,
                        ranked: 1,
                        matchmakingAttempts: 1,
                        ratingDifference: { $abs: { $subtract: ['$lineup.team.rating', lineupQueue.lineup.team.rating] } }
                    }
                },
                {
                    $match: {
                        ratingDifference: { $lte: maxRatingDifference }
                    }
                },
                {
                    $sort: {
                        ratingDifference: 1,
                        matchmakingAttempts: 1
                    }
                }
            ])

            if (lineupQueueToChallenge.length > 0) {
                if (await this.checkForDuplicatedPlayers(client, lineupQueue.lineup, Lineup.hydrate(lineupQueueToChallenge[0].lineup))) {
                    continue
                }

                const initiatingUser = lineupQueue.lineup.getNonMercSignedRoles()[0].user!
                const challenge = new Challenge({
                    initiatingUser,
                    initiatingTeam: lineupQueue,
                    challengedTeam: lineupQueueToChallenge[0]
                })

                await this.readyMatch(client, undefined, challenge)
                lineupQueues.splice(i, 1)
                lineupQueues.splice(lineupQueues.findIndex(lq => lq._id.toString() === lineupQueueToChallenge[0]._id.toString()), 1)
                i--
            } else if (lineupQueue.matchmakingAttempts < this.MAX_ATTEMPTS_BEFORE_WIDE_SEARCH) {
                lineupQueue.matchmakingAttempts++
                await lineupQueue.save()
            }
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

    async findAvailableQueuedTeams(region: Region, channelId: string, lineupSize: number, ranked: boolean): Promise<ILineupQueue[]> {
        const match = {
            'lineup.channelId': { '$ne': channelId },
            'lineup.team.region': region,
            'lineup.size': lineupSize,
            'lineup.type': LINEUP_TYPE_TEAM,
            'challengeId': null,
            ranked
        }

        return LineupQueue.find(match)
    }

    async findAvailableQueuedMixes(region: Region, channelId: string, lineupSize: number, ranked: boolean): Promise<ILineupQueue[]> {
        const match = {
            'lineup.channelId': { '$ne': channelId },
            'lineup.team.region': region,
            'lineup.size': lineupSize,
            'lineup.visibility': LINEUP_VISIBILITY_PUBLIC,
            'lineup.type': LINEUP_TYPE_MIX,
            challengeId: null,
            ranked
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


    async joinQueue(client: Client, lineup: ILineup, ranked: boolean): Promise<ILineupQueue> {
        if (ranked) {
            lineup.autoMatchmaking = true
        }
        const lineupQueue = new LineupQueue({ lineup, ranked })
        const channelIds = await teamService.findAllChannelIdToNotify(lineup.team.region, lineup.channelId, lineup.size)

        if (!ranked && lineup.lastSearchTime && Math.abs(lineup.lastSearchTime.getTime() - Date.now()) > 5 * 60 * 1000) {
            await teamService.updateLastSearchTime(lineup.channelId, new Date())

            let teamEmbedDescription = lineup.prettyPrintName()
            teamEmbedDescription += `\n**${lineup.numberOfSignedPlayers()}** players${!lineup.hasGkSigned() ? ' **(no Goal Keeper)**' : ''}`
            const teamEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle('A team wants to play a casual match !')
                .setDescription(teamEmbedDescription)
                .setTimestamp()

            const challengeTeamRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`challenge_${lineupQueue.id}`)
                    .setLabel('Challenge them !')
                    .setEmoji('⚽')
                    .setStyle(ButtonStyle.Primary)
            )

            for (let channelId of channelIds) {
                const [channel] = await handle(client.channels.fetch(channelId))
                if (!(channel instanceof TextChannel)) {
                    continue
                }
                handle(channel.send({ embeds: [teamEmbed], components: [challengeTeamRow] }))
            }
        }

        lineupQueue.save()
        return lineupQueue
    }


    async leaveQueue(lineupQueue: ILineupQueue): Promise<void> {
        if (lineupQueue.lineup.isNotTeam()) {
            return
        }

        await this.deleteLineupQueuesByChannelId(lineupQueue.lineup.channelId)
    }

    async listChallenges(interaction: ButtonInteraction | CommandInteraction, lineup: ILineup, ranked: boolean): Promise<void> {
        await interaction.deferReply()
        const gameMode = ranked ? 'Ranked' : 'Casual'

        if (!ranked) {
            const availableTeams = await matchmakingService.findAvailableQueuedTeams(lineup.team.region, lineup.channelId, lineup.size, ranked)
            const teamLineupsEmbed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle(`Teams (${gameMode})`)
            let teamsActionComponents: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = []
            if (availableTeams.length === 0) {
                teamLineupsEmbed.setDescription(`No Team available for ${lineup.size}v${lineup.size}`)
            } else {
                let teamLineupEmbedDescription = ''
                for (let availableTeam of availableTeams) {
                    teamLineupEmbedDescription += `${availableTeam.lineup.prettyPrintName(TeamLogoDisplay.LEFT, availableTeam.lineup.team.verified)}\n`
                    teamLineupEmbedDescription += `**${availableTeam.lineup.numberOfSignedPlayers()}** players${!availableTeam.lineup.hasGkSigned() ? ' **(no Goal Keeper)**' : ''}`
                    teamLineupEmbedDescription += '\n\n'
                }
                teamLineupsEmbed.setDescription(teamLineupEmbedDescription)
                let teamsActionRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>()
                if (availableTeams.length < 6) {
                    for (let availableTeam of availableTeams) {
                        const button = new ButtonBuilder()
                            .setCustomId(`challenge_${availableTeam._id}`)
                            .setLabel(availableTeam.lineup.prettyPrintName(TeamLogoDisplay.NONE, false, false))
                            .setStyle(ButtonStyle.Primary)
                        const validatedTeamLogo = await teamService.validateTeamLogo(interaction.client, availableTeam.lineup.team.guildId, availableTeam.lineup.team.logo)
                        if (validatedTeamLogo) {
                            button.setEmoji(validatedTeamLogo)
                        }
                        teamsActionRow.addComponents(button)
                    }
                } else {
                    const challengesSelectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`select_challenge`)
                        .setPlaceholder('Select a Team to challenge')
                    for (let availableTeam of availableTeams) {
                        let selectMenuOption: SelectMenuComponentOptionData = { label: availableTeam.lineup.prettyPrintName(TeamLogoDisplay.NONE, false, false), value: availableTeam._id.toString() }
                        const validatedTeamLogo = await teamService.validateTeamLogo(interaction.client, availableTeam.lineup.team.guildId, availableTeam.lineup.team.logo)
                        if (validatedTeamLogo) {
                            selectMenuOption.emoji = validatedTeamLogo
                        }
                        challengesSelectMenu.addOptions([selectMenuOption])
                    }
                    teamsActionRow.addComponents(challengesSelectMenu)
                }
                teamsActionComponents = [teamsActionRow]
            }
            await interaction.channel?.send({ embeds: [teamLineupsEmbed], components: teamsActionComponents })
        }

        let availableMixes = await matchmakingService.findAvailableQueuedMixes(lineup.team.region, lineup.channelId, lineup.size, ranked)
        const mixLineupsEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`Mixes (${gameMode})`)
        if (ranked) {
            const teamAvailableTierRoleIds = lineup.team.getAvailableTierRoleIds()
            const filteredMixes = []
            for (let mix of availableMixes) {
                const mixTierRoleId = await mix.lineup.getTierRoleId(interaction.client)
                if (teamAvailableTierRoleIds.includes(mixTierRoleId)) {
                    filteredMixes.push(mix)
                }
            }
            availableMixes = filteredMixes
        }
        let mixesActionComponents: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = []
        if (availableMixes.length === 0) {
            mixLineupsEmbed.setDescription(`No Mix available for ${lineup.size}v${lineup.size}`)
        } else {
            let mixLineupEmbedDescription = ''
            for (let availableMix of availableMixes) {
                mixLineupEmbedDescription += `${availableMix.lineup.prettyPrintName(TeamLogoDisplay.LEFT)}\n`
                mixLineupEmbedDescription += `**${availableMix.lineup.numberOfSignedPlayers()}** players`
                if (availableMix.lineup.numberOfSignedPlayers() > 0 && !availableMix.lineup.hasGkSigned()) {
                    mixLineupEmbedDescription += ' **(no Goal Keeper)**'
                }
                mixLineupEmbedDescription += '\n\n'
            }
            mixLineupsEmbed.setDescription(mixLineupEmbedDescription)
            let mixesActionRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>()
            if (availableMixes.length < 6) {
                for (let availableMix of availableMixes) {
                    const button = new ButtonBuilder()
                        .setCustomId(`challenge_${availableMix._id}`)
                        .setLabel(availableMix.lineup.prettyPrintName(TeamLogoDisplay.NONE, false, false))
                        .setStyle(ButtonStyle.Primary)
                    const validatedTeamLogo = await teamService.validateTeamLogo(interaction.client, availableMix.lineup.team.guildId, availableMix.lineup.team.logo)
                    if (validatedTeamLogo) {
                        button.setEmoji(validatedTeamLogo)
                    }
                    mixesActionRow.addComponents(button)
                }
            } else {
                const challengesSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`select_challenge`)
                    .setPlaceholder('Select a Mix to challenge')
                for (let availableMix of availableMixes) {
                    let selectMenuOption: SelectMenuComponentOptionData = { label: availableMix.lineup.prettyPrintName(TeamLogoDisplay.NONE, false, false), value: availableMix._id.toString() }
                    const validatedTeamLogo = await teamService.validateTeamLogo(interaction.client, availableMix.lineup.team.guildId, availableMix.lineup.team.logo)
                    if (validatedTeamLogo) {
                        selectMenuOption.emoji = validatedTeamLogo
                    }
                    challengesSelectMenu.addOptions([selectMenuOption])
                }
                mixesActionRow.addComponents(challengesSelectMenu)
            }
            mixesActionComponents = [mixesActionRow]
        }

        await interaction.editReply({ embeds: [mixLineupsEmbed], components: mixesActionComponents })
    }

    async challenge(interaction: ButtonInteraction | AnySelectMenuInteraction, lineupQueueIdToChallenge: string): Promise<void> {
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

        const lineupHasAnyMerc = lineup.roles.some(role => role.user?.isMerc())
        if (lineupHasAnyMerc && lineupQueueToChallenge.ranked) {
            await interaction.reply({ content: "⛔ You can't challenge a ranked team with a merc signed", ephemeral: true })
            return
        }

        let lineupQueue = await this.findLineupQueueByChannelId(interaction.channelId) || undefined

        const duplicatedUsersReply = await this.checkForDuplicatedPlayers(interaction.client, lineup, lineupQueueToChallenge.lineup)
        if (duplicatedUsersReply) {
            await interaction.reply(duplicatedUsersReply)
            return
        }

        await (interaction.message as Message).edit({ components: [] })
        await interaction.deferReply()

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
        let challengedMessage = await channel!.send(interactionUtils.createDecideChallengeReply(interaction, challenge) as BaseMessageOptions)
        challenge.challengedMessageId = challengedMessage.id

        await this.reserveLineupQueuesByIds([lineupQueueIdToChallenge, lineupQueue._id.toString()], challenge._id.toString())
        let initiatingMessage = await interaction.editReply(interactionUtils.createCancelChallengeReply(interaction, challenge))
        challenge.initiatingMessageId = initiatingMessage.id

        await challenge.save()

        if (await this.isNotTeamAndReadyToStart(lineupQueueToChallenge.lineup)) {
            await this.readyMatch(interaction.client, interaction, challenge, lineup)
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
            promises.push(challengedTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(`❌ ${challenge.initiatingTeam.lineup.prettyPrintName()} has cancelled the challenge request`, user)] }))
        }

        const [initiatingTeamChannel] = await handle(client.channels.fetch(challenge.initiatingTeam.lineup.channelId))
        if (initiatingTeamChannel?.type === ChannelType.GuildText) {
            if (challenge.initiatingMessageId) {
                promises.push(initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] }))
            }
            promises.push(initiatingTeamChannel.send({ embeds: [interactionUtils.createInformationEmbed(`❌ ${user} has cancelled the challenge request against ${challenge.challengedTeam.lineup.prettyPrintName()}`, user)] }))
        }

        await Promise.all(promises)
    }


    async checkIfAutoSearch(client: Client, user: User, lineup: ILineup): Promise<AutoSearchResult> {
        const lineupQueue = await this.findLineupQueueByChannelId(lineup.channelId) || undefined
        let autoSearchResult = { joinedQueue: false, leftQueue: false, cancelledChallenge: false, updatedLineupQueue: lineupQueue }

        if (lineup.isNotTeam()) {
            return autoSearchResult
        }

        if (lineup.autoSearch === true && this.isLineupAllowedToJoinQueue(lineup) && !lineupQueue) {
            autoSearchResult.updatedLineupQueue = await this.joinQueue(client, lineup, lineup.isAllowedToPlayRanked())
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

    async isNotTeamAndReadyToStart(lineup: ILineup): Promise<boolean> {
        if (lineup.isCaptains() || lineup.isSoloQueue()) {
            return this.isLineupAllowedToJoinQueue(lineup)
        }

        const challenge = await this.findChallengeByChannelId(lineup.channelId)

        if (challenge && challenge.challengedTeam.lineup.isMix()) {
            const initiatingTeamLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
            const mixLineup = await teamService.retrieveLineup(challenge.challengedTeam.lineup.channelId)

            const missingRolesForTeam = initiatingTeamLineup!.roles.filter(role => !role.user)
            const missingRolesForMix = mixLineup!.roles.filter(role => role.lineupNumber === 1).filter(role => !role.user)
            const allMissingRoles = missingRolesForMix.concat(missingRolesForTeam)

            if (challenge.initiatingTeam.ranked && challenge.challengedTeam.ranked) {
                return allMissingRoles.length === 0
            }

            return allMissingRoles.length === 0 || (lineup.size > 3 && (allMissingRoles.length === 1 && allMissingRoles[0].name.includes('GK')))
        }

        if (!challenge && lineup.isMix()) {
            return this.isLineupAllowedToJoinQueue(lineup)
        }

        return false
    }

    async checkForDuplicatedPlayers(client: Client, firstLineup: ILineup, secondLineup?: ILineup): Promise<InteractionReplyOptions | null> {
        let firstLineupUsers: IUser[]
        let secondLineupUsers: IUser[]
        if (secondLineup) {
            firstLineupUsers = firstLineup.getNonMercSignedRoles(1).map(role => role.user).filter(notEmpty)
            secondLineupUsers = secondLineup.getNonMercSignedRoles(1).map(role => role.user).filter(notEmpty)
        } else {
            firstLineupUsers = firstLineup.getNonMercSignedRoles(1).map(role => role.user).filter(notEmpty)
            secondLineupUsers = firstLineup.getNonMercSignedRoles(2).map(role => role.user).filter(notEmpty)
        }

        let duplicatedUsers = firstLineupUsers.filter(user => secondLineupUsers.some(t => t.id === user.id))
        if (duplicatedUsers.length > 0) {
            let description = 'The following players are signed in both teams. Please arrange with them before challenging: '
            for (let duplicatedUser of duplicatedUsers) {
                let discordUser = await client.users.fetch(duplicatedUser.id)
                description += discordUser.toString() + ', '
            }
            description = description.substring(0, description.length - 2)

            const duplicatedUsersEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle(`⛔ Some players are signed in both teams !`)
                .setDescription(description)
                .setTimestamp()

            return { embeds: [duplicatedUsersEmbed] }
        }

        return null
    }


    async readyMatch(client: Client, interaction?: Interaction, challenge?: IChallenge, mixLineup?: ILineup): Promise<void> {
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
            if (mixLineup!.isSoloQueue() && mixLineup?.allowRanked) {
                mixLineup.distributeRolesForSoloQueue()
            }
            initiatingLineup = Lineup.hydrate((mixLineup as any).toObject())
            initiatingLineup.roles = initiatingLineup.roles.filter(role => role.lineupNumber === 1) as IRole[]
            initiatingLineup.name = "Red Team"
            challengedLineup = Lineup.hydrate((mixLineup as any).toObject())
            challengedLineup.roles = challengedLineup.roles.filter(role => role.lineupNumber === 2) as IRole[]
            challengedLineup.roles.filter(role => role.lineupNumber === 2).forEach(role => role.lineupNumber = 1)
            challengedLineup.name = "Blue Team"
            ranked = mixLineup!.allowRanked
        }

        const lobbyHost = interaction ? interaction.user : await client.users.fetch(challenge!.initiatingUser.id)
        const lobbyName = challenge ?
            `${challenge.initiatingTeam.lineup.prettyPrintName(TeamLogoDisplay.RIGHT)} **vs** ${challenge.challengedTeam.lineup.prettyPrintName(TeamLogoDisplay.LEFT)}`
            : `**${mixLineup!.prettyPrintName()} #${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}**`
        const lobbyPassword = Math.random().toString(36).slice(-4)
        const match = new Match({
            matchId: uuidv4().substring(0, 8),
            schedule: Date.now(),
            lobbyName,
            lobbyPassword,
            firstLineup: initiatingLineup,
            secondLineup: challengedLineup,
            ranked
        })

        if (ranked) {
            const firstLineupCaptainId = await this.findHighestRatedUserId(match.firstLineup)
            const secondLineupCaptainId = await this.findHighestRatedUserId(match.secondLineup)
            match.result = {
                firstLineup: {
                    captainUserId: firstLineupCaptainId,
                },
                secondLineup: {
                    captainUserId: secondLineupCaptainId
                }
            } as IMatchResult
        }

        await match.save()
        await this.notifyForMatchReady(client, match, lobbyHost, initiatingLineup, challengedLineup)
        await this.sendMatchResultVoteMessage(client, match)

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
                const reply = await interactionUtils.createReplyForLineup(newInitiatingTeamLineup) as BaseMessageOptions
                const initiatingTeamChannel = await client.channels.fetch(challenge.initiatingTeam.lineup.channelId) as TextChannel
                await initiatingTeamChannel.send(reply)
                if (challenge.initiatingMessageId) {
                    await initiatingTeamChannel.messages.edit(challenge.initiatingMessageId, { components: [] })
                }
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
                    const reply = await interactionUtils.createReplyForLineup(newMixLineup) as BaseMessageOptions
                    const challengedTeamChannel = await client.channels.fetch(challenge.challengedTeam.lineup.channelId) as TextChannel
                    await challengedTeamChannel.send(reply)
                } else {
                    await this.leaveQueue(challenge.challengedTeam)
                    const newChallengedTeamLineup = nonNullChallengedLineup.moveAllBenchToLineup()
                    await teamService.upsertLineup(newChallengedTeamLineup)
                    const reply = await interactionUtils.createReplyForLineup(newChallengedTeamLineup) as BaseMessageOptions
                    const [channel] = await handle(client.channels.fetch(newChallengedTeamLineup.channelId)) as TextChannel[]
                    await channel?.send(reply)
                }
                resolve()
            }))
            await Promise.all(promises)

            await Promise.all([
                statsService.updatePlayersStats(client, challenge.initiatingTeam.lineup.team.region, challenge.initiatingTeam.lineup.size, initiatingTeamUsers.map(user => user.id)),
                statsService.updatePlayersStats(client, challenge.challengedTeam.lineup.team.region, challenge.challengedTeam.lineup.size, challengedTeamUsers.map(user => user.id))
            ])
        }
        else { //This is a mix vs mix match     
            const allUsers = mixLineup!.roles.map(role => role.user).filter(notEmpty)
            let newMixLineup = mixLineup!
            if (newMixLineup.isCaptains()) {
                newMixLineup = teamService.createLineup(newMixLineup.channelId, newMixLineup.size, "", false, newMixLineup.allowRanked, newMixLineup.team, LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM, false)
            } else {
                newMixLineup = newMixLineup.moveAllBenchToLineup(1).moveAllBenchToLineup(2)
            }
            newMixLineup.lastMatchDate = match.schedule
            await teamService.upsertLineup(newMixLineup)
            await teamService.updateTeamLastMatchDateByGuildId(newMixLineup.team.guildId, match.schedule)
            const reply = await interactionUtils.createReplyForLineup(newMixLineup) as BaseMessageOptions
            const [channel] = await handle(client.channels.fetch(newMixLineup.channelId)) as TextChannel[]
            await channel?.send(reply)
            await this.updateLineupQueueRoles(newMixLineup.channelId, newMixLineup.roles)
            await statsService.updatePlayersStats(client, newMixLineup.team.region, newMixLineup.size, allUsers.map(user => user.id))
        }
    }

    async sendMatchResultVoteMessage(client: Client, match: IMatch): Promise<void> {
        if (!match.ranked) {
            return
        }

        let promises = []
        promises.push(new Promise<void>(async (resolve) => {
            const firstLineupUser = await client.users.fetch(match.result!.firstLineup.captainUserId)
            const firstLineupChannel = await client.channels.fetch(match.firstLineup.channelId) as TextChannel
            const message = await firstLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, firstLineupUser, 1))
            handle(firstLineupUser.send(interactionUtils.createMatchResultVoteUserMessage(message)))
            resolve()
        }))
        promises.push(new Promise<void>(async (resolve) => {
            const secondLineupUser = await client.users.fetch(match.result!.secondLineup.captainUserId)
            const secondLineupChannel = await client.channels.fetch(match.secondLineup.channelId) as TextChannel
            const message = await secondLineupChannel.send(interactionUtils.createMatchResultVoteMessage(match.matchId, match.firstLineup.team.region, secondLineupUser, 2))
            handle(secondLineupUser.send(interactionUtils.createMatchResultVoteUserMessage(message)))
            resolve()
        }))

        await Promise.all(promises)
    }

    async findTwoMostRelevantCaptains(userIds: string[]): Promise<IPlayerStats[]> {
        let pipeline = <any>[]
        pipeline.push(
            {
                $match: { 'userId': { $in: userIds } }
            }
        )

        pipeline = pipeline.concat([
            {
                $sort: { 'numberOfRankedGames': -1 },
            },
            {
                $limit: 2
            }
        ])

        return PlayerStats.aggregate(pipeline)
    }

    async findMatchByMatchId(matchId: string): Promise<IMatch | null> {
        return Match.findOne({ matchId })
    }

    async findRecentMatches(): Promise<IMatch[] | null> {
        return Match.find().sort({ 'schedule': -1 }).limit(10)
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

    async updateMatchResult(matchId: string, lineupToUpdate: number, result: MatchResult): Promise<IMatch | null> {
        return Match.findOneAndUpdate(
            { matchId },
            { "$set": lineupToUpdate === 1 ? { "result.firstLineup.result": result } : { "result.secondLineup.result": result } },
            { new: true }
        )
    }

    async resetMatchResult(matchId: string): Promise<UpdateWriteOpResult> {
        return Match.updateOne(
            { matchId },
            { "$unset": { "result.firstLineup.result": "", "result.secondLineup.result": "" } }
        )
    }

    async updateRatings(client: Client, match: IMatch): Promise<void> {
        await Promise.all([
            this.updateTeamsRating(match),
            this.updatePlayersRating(client, match)
        ])
    }

    private async findHighestRatedUserId(lineup: ILineup): Promise<string> {
        const userIds: string[] = lineup.getNonMercSignedRoles().map(role => role.user?.id).filter(notEmpty)

        let pipeline = <any>[]
        pipeline.push(
            {
                $match: { 'userId': { $in: userIds }, 'region': lineup.team.region }
            }
        )

        pipeline = pipeline.concat([
            {
                $group: {
                    _id: '$userId',
                    rating: {
                        $avg: '$rating',
                    }
                }
            },
            {
                $sort: { 'rating': -1 },
            },
            {
                $limit: 1
            }
        ])

        const stats: IPlayerStats[] = await PlayerStats.aggregate(pipeline)

        if (stats.length === 0) {
            return userIds[0]
        }

        return (stats[0] as any)._id
    }

    private async updateTeamsRating(match: IMatch): Promise<void> {
        let firstTeamStats = await statsService.findTeamStats(match.firstLineup.team.guildId, match.firstLineup.team.region)
        if (!firstTeamStats) {
            firstTeamStats = new TeamStats({
                guildId: match.firstLineup.team.guildId,
                region: match.firstLineup.team.region,
                numberOfRankedWins: 0,
                numberOfRankedDraws: 0,
                numberOfRankedLosses: 0,
                totalNumberOfRankedWins: 0,
                totalNumberOfRankedDraws: 0,
                totalNumberOfRankedLosses: 0,
                rating: DEFAULT_RATING
            })
        }
        let secondTeamStats = await statsService.findTeamStats(match.secondLineup.team.guildId, match.secondLineup.team.region)
        if (!secondTeamStats) {
            secondTeamStats = new TeamStats({
                guildId: match.secondLineup.team.guildId,
                region: match.secondLineup.team.region,
                numberOfRankedWins: 0,
                numberOfRankedDraws: 0,
                numberOfRankedLosses: 0,
                totalNumberOfRankedWins: 0,
                totalNumberOfRankedDraws: 0,
                totalNumberOfRankedLosses: 0,
                rating: DEFAULT_RATING
            })
        }

        const firstTeamRating = match.firstLineup.isTeam() ? firstTeamStats.rating : match.firstLineup.computePlayersAverageRating()
        const secondTeamRating = match.secondLineup.isTeam() ? secondTeamStats.rating : match.secondLineup.computePlayersAverageRating()

        let elo = new Elo()
            .playerA(firstTeamRating)
            .playerB(secondTeamRating)
        if (match.result!.firstLineup.result === MatchResult.DRAW) {
            elo.setDraw()
            firstTeamStats.numberOfRankedDraws++
            firstTeamStats.totalNumberOfRankedDraws++
            secondTeamStats.numberOfRankedDraws++
            secondTeamStats.totalNumberOfRankedDraws++
        } else if (match.result!.firstLineup.result === MatchResult.WIN) {
            elo.setWinnerA()
            firstTeamStats.numberOfRankedWins++
            firstTeamStats.totalNumberOfRankedWins++
            secondTeamStats.numberOfRankedLosses++
            secondTeamStats.totalNumberOfRankedLosses++
        } else {
            elo.setWinnerB()
            firstTeamStats.numberOfRankedLosses++
            firstTeamStats.totalNumberOfRankedLosses++
            secondTeamStats.numberOfRankedWins++
            secondTeamStats.totalNumberOfRankedWins++
        }

        const [firstLineupNewRating, secondLineupNewRating] = elo.calculate().getResults()
        firstTeamStats.rating = firstLineupNewRating
        secondTeamStats.rating = secondLineupNewRating
        if (match.firstLineup.isTeam()) {
            await teamService.updateTeamRating(match.firstLineup.team.guildId, match.firstLineup.team.region, firstTeamStats)
        }
        if (match.secondLineup.isTeam()) {
            await teamService.updateTeamRating(match.secondLineup.team.guildId, match.firstLineup.team.region, secondTeamStats)
        }
    }

    private async updatePlayersRating(client: Client, match: IMatch): Promise<void> {
        const firstLineupRating = await new LineupRating(match.firstLineup, match.result!.firstLineup.result!).init()
        const secondLineupRating = await new LineupRating(match.secondLineup, match.result!.secondLineup.result!).init()
        const regionGuild = await regionService.getRegionGuild(client, match.firstLineup.team.region)
        const firstLineupRatingAverage = match.firstLineup.computePlayersAverageRating()
        const secondLineupRatingAverage = match.secondLineup.computePlayersAverageRating()

        match.firstLineup.getNonMercSignedRoles().map(role => role.user!).forEach(async user => {
            const newRating = firstLineupRating.computeNewPlayerRating(user.id, secondLineupRatingAverage)
            if (newRating) {
                await statsService.updatePlayerRating(user.id, match.firstLineup.team.region, newRating.stats)

                if (!match.firstLineup.isCaptains()) {
                    const member = await regionGuild?.members.fetch(user.id)
                    if (member) {
                        await regionService.updateMemberTierRole(match.firstLineup.team.region, member, newRating.stats)
                    }
                }
            }
        })

        match.secondLineup.getNonMercSignedRoles().map(role => role.user!).forEach(async user => {
            const newRating = secondLineupRating.computeNewPlayerRating(user.id, firstLineupRatingAverage)
            if (newRating) {
                await statsService.updatePlayerRating(user.id, match.secondLineup.team.region, newRating.stats)

                if (!match.secondLineup.isCaptains()) {
                    const member = await regionGuild?.members.fetch(user.id)
                    if (member) {
                        await regionService.updateMemberTierRole(match.firstLineup.team.region, member, newRating.stats)
                    }
                }
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
            if (!role.user || role.user.isMerc()) {
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

    private async notifyUsersForMatchReady(client: Client, match: IMatch, lobbyHost: User, lineup: ILineup, lineupRoles: RoleWithDiscordUser[], opponentLineup: ILineup, opponentLineupRoles: RoleWithDiscordUser[]): Promise<void> {
        let discordUsersWithoutDm: User[] = []

        const promises = lineupRoles.map(async role => {
            if (!role.discordUser) {
                return
            }

            let embeds = []
            embeds.push(new EmbedBuilder()
                .setColor('#6aa84f')
                .setTitle(`⚽ Match Ready ⚽`)
                .setDescription(`
                    **Please join the match as soon as possible**
                    The lobby can be found in the **"Custom Lobbies"** menu of the game
                    ${match.ranked ? '' : '*If you need a sub, use the **/sub_request** command*'}`)
                .addFields([
                    { name: 'Match ID', value: `${match.matchId}` },
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
            const [channel] = await handle(client.channels.fetch(lineup.channelId)) as TextChannel[]
            const embed = new EmbedBuilder()
                .setColor('#6aa84f')
                .setTitle('⚠ Some players did not receive the lobby information ⚠')
                .setDescription(discordUsersWithoutDm.join(', '))
                .setTimestamp()
            await channel?.send({ embeds: [embed] })
        }
    }

    private async notifyLineupsForUsersLeaving(client: Client, lineup: ILineup, rolesWithDiscordUsers: RoleWithDiscordUser[]) {
        const promises = rolesWithDiscordUsers
            .map(roleWithDiscordUser => roleWithDiscordUser.discordUser)
            .filter(notEmpty)
            .map(async discordUser => {
                const channelIds = await teamService.findAllLineupChannelIdsByUserId(discordUser.id, [lineup.channelId])
                if (channelIds.length > 0) {
                    await Promise.all(channelIds.map(async (channelId: string) => {
                        await teamService.notifyChannelForUserLeaving(client, discordUser, channelId, `⚠ ${discordUser} went to play another match with ${lineup.prettyPrintName()}`)
                    }))
                }
            })

        return Promise.all(promises)
    }

    private async notifyLineupChannelForMatchReady(client: Client, lobbyHost: User, lineup: ILineup, lineupRoles: RoleWithDiscordUser[], opponentLineup: ILineup, opponentLineupRoles: RoleWithDiscordUser[]) {
        let embeds = []

        embeds.push(interactionUtils.createLineupEmbed(lineupRoles, lineup))
        embeds.push(interactionUtils.createLineupEmbed(opponentLineupRoles, opponentLineup))

        const matchReadyEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle(`${opponentLineup ? '⚽ Challenge Accepted ⚽' : '⚽ Match Ready ⚽'}`)
            .setTimestamp()
            .setDescription(`**${lobbyHost.username}** is responsible of creating the lobby\nPlease check your direct messages to find the lobby information`)
        embeds.push(matchReadyEmbed)

        const channel = await client.channels.fetch(lineup.channelId) as TextChannel
        await channel.send({ embeds })
    }

    private async notifyForMatchReady(client: Client, match: IMatch, lobbyHost: User, firstLineup: ILineup, secondLineup: ILineup) {
        const firstLineupRoles = await this.enhanceWithDiscordUsers(client, firstLineup.roles)
        const secondLineupRoles = await this.enhanceWithDiscordUsers(client, secondLineup.roles)
        let promises = []
        promises.push(this.notifyUsersForMatchReady(client, match, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
        promises.push(this.notifyUsersForMatchReady(client, match, lobbyHost, secondLineup, secondLineupRoles, firstLineup, firstLineupRoles))
        promises.push(this.notifyLineupsForUsersLeaving(client, firstLineup, firstLineupRoles))
        promises.push(this.notifyLineupsForUsersLeaving(client, secondLineup, secondLineupRoles))
        if (firstLineup.isNotTeam() && secondLineup.isNotTeam()) {
            promises.push(this.notifyLineupChannelForMatchReady(client, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
        } else {
            promises.push(this.notifyLineupChannelForMatchReady(client, lobbyHost, firstLineup, firstLineupRoles, secondLineup, secondLineupRoles))
            promises.push(this.notifyLineupChannelForMatchReady(client, lobbyHost, secondLineup, secondLineupRoles, firstLineup, firstLineupRoles))
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
    private readonly zscore: typeof ZScore
    private readonly rankedStatsByUserId: Map<string, RankedStats> = new Map()
    private readonly matchResult: MatchResult
    private readonly kFactorPerNumberOfGames: Map<string, number> = new Map().set("800", 10).set("250", 20).set("25", 30)

    constructor(lineup: ILineup, matchResult: MatchResult) {
        this.lineup = lineup
        this.zscore = new ZScore()
        this.matchResult = matchResult
    }

    public async init() {
        await Promise.all(this.lineup.getNonMercSignedRoles().map(async role => {
            let playerStats = await statsService.findPlayerStats(role.user!.id, this.lineup.team.region)
            if (!playerStats) {
                playerStats = new PlayerStats({
                    userId: role.user?.id,
                    region: this.lineup.team.region,
                    numberOfRankedGames: 0,
                    numberOfRankedWins: 0,
                    numberOfRankedDraws: 0,
                    numberOfRankedLosses: 0,
                    totalNumberOfRankedWins: 0,
                    totalNumberOfRankedDraws: 0,
                    totalNumberOfRankedLosses: 0,
                    rating: DEFAULT_RATING,
                    mixCaptainsRating: DEFAULT_RATING
                })
            }

            this.rankedStatsByUserId.set(role.user!.id, {
                role,
                stats: playerStats
            })
        }))

        const allPlayersRatings = Array.from(this.rankedStatsByUserId.values()).map(rankedStats => this.lineup.isCaptains() ? rankedStats.stats.mixCaptainsRating : rankedStats.stats.rating)
        this.zscore.setMeanAndDeviationFromDataset(allPlayersRatings, true)
        return this
    }

    public getPlayerRating(userId: string): RankedStats | null {
        return this.rankedStatsByUserId.get(userId) || null
    }

    public computeNewPlayerRating(userId: string, opponentLineupRatingAverage: number): RankedStats | null {
        const rankedStats = this.rankedStatsByUserId.get(userId)
        if (!rankedStats) {
            return null
        }

        const rating = this.lineup.isCaptains() ? rankedStats.stats.mixCaptainsRating : rankedStats.stats.rating
        const matchesPlayed = rankedStats.stats.numberOfRankedWins + rankedStats.stats.numberOfRankedDraws + rankedStats.stats.numberOfRankedLosses
        const zscore = Math.abs(this.zscore.getZScore(rating)) || 0
        let k = Array.from(this.kFactorPerNumberOfGames.entries()).find(e => matchesPlayed >= parseInt(e[0]))?.[1] || 40
        k /= Math.max(1, 0.3 * Math.exp(zscore))

        let elo = new Elo(k)
            .playerA(rating)
            .playerB(opponentLineupRatingAverage)
        if (this.matchResult === MatchResult.DRAW) {
            elo.setDraw()
            rankedStats.stats.numberOfRankedDraws++
            rankedStats.stats.totalNumberOfRankedDraws++
        } else if (this.matchResult === MatchResult.WIN) {
            elo.setWinnerA()
            rankedStats.stats.numberOfRankedWins++
            rankedStats.stats.totalNumberOfRankedWins++
        } else {
            elo.setWinnerB()
            rankedStats.stats.numberOfRankedLosses++
            rankedStats.stats.totalNumberOfRankedLosses++
        }

        const newRating = elo.calculate().getResults()[0]
        if (this.lineup.isCaptains()) {
            rankedStats.stats.mixCaptainsRating = newRating
        } else {
            rankedStats.stats.rating = newRating
        }

        return rankedStats
    }
}