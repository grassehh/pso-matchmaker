import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Client, CommandInteraction, EmbedBuilder, InteractionReplyOptions, SelectMenuInteraction, User } from "discord.js";
import { Types } from "mongoose";
import { matchmakingService } from "./matchmakingService";
import { statsService } from "./statsService";
import { teamService } from "./teamService";
import { DEFAULT_LEADERBOARD_PAGE_SIZE } from "../constants";
import { IChallenge, ILineup, ILineupQueue, IRole, IRoleBench, IStats, IUser } from "../mongoSchema";
import { handle } from "../utils";
import { RoleWithDiscordUser } from "./matchmakingService";
import { ROLE_ATTACKER, ROLE_DEFENDER, ROLE_GOAL_KEEPER, ROLE_MIDFIELDER } from "./teamService";

class InteractionUtils {
    createReplyAlreadyQueued(lineupSize: number): InteractionReplyOptions {
        return {
            content: `⛔ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command`,
            ephemeral: true
        }
    }

    createReplyNotQueued(): InteractionReplyOptions {
        return {
            content: `⛔ Your team is not queued for matchmaking`,
            ephemeral: true
        }
    }

    createReplyTeamNotRegistered(): InteractionReplyOptions {
        return {
            content: '⛔ Please register your team with the /register_team command first',
            ephemeral: true
        }
    }

    createReplyMatchDoesntExist(): InteractionReplyOptions {
        return {
            content: '⛔ This match does not exist',
            ephemeral: true
        }
    }

    createReplyAlreadyChallenging(challenge: IChallenge): InteractionReplyOptions {
        return {
            content: `⛔ Your team is negotiating a challenge between the teams '${teamService.formatTeamName(challenge.initiatingTeam.lineup)}' and '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'`,
            ephemeral: true
        }
    }

    createReplyLineupNotSetup(): InteractionReplyOptions {
        return {
            content: '⛔ This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
            ephemeral: true
        }
    }

    createCancelChallengeReply(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, challenge: IChallenge): InteractionReplyOptions {
        let embed = new EmbedBuilder()
            .setColor('#566573')
            .setFooter({ text: `Author: ${interaction.user.username}` })
            .setTimestamp()

        if (challenge.challengedTeam.lineup.isMix()) {
            embed.setDescription(`💬 ${interaction.user} is challenging the mix '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'.\nThe match will start automatically once the mix lineup is full.`)
        } else {
            embed.setDescription(`💬 ${interaction.user} has sent a challenge request to the team '${teamService.formatTeamName(challenge.challengedTeam.lineup)}'.\nYou can either wait for their answer, or cancel your request.`)
        }

        let cancelChallengeRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel_challenge_${challenge._id}`)
                    .setLabel(`Cancel Challenge`)
                    .setStyle(ButtonStyle.Danger)
            )

        return { embeds: [embed], components: [cancelChallengeRow] }
    }

    createDecideChallengeReply(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, challenge: IChallenge): InteractionReplyOptions {
        if (challenge.challengedTeam.lineup.isMix()) {
            let reply = this.createReplyForMixLineup(challenge.challengedTeam.lineup, challenge.initiatingTeam.lineup)
            reply.embeds = reply.embeds?.concat(this.createInformationEmbed(interaction.user, `**${teamService.formatTeamName(challenge.initiatingTeam.lineup)}** is challenging the mix`))
            return reply
        } else {
            let description = `**${teamService.formatTeamName(challenge.initiatingTeam.lineup)}**`
            const challengeEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle(`A team wants to play against you !`)
                .setTimestamp()
                .setFooter({ text: `Author: ${interaction.user.username}` })
            description += `\n${challenge.initiatingTeam.lineup.roles.filter(role => role.user != null).length} players signed`
            if (!teamService.hasGkSigned(challenge.initiatingTeam.lineup)) {
                description += ' **(no GK)**'
            }
            description += `\n\n*Contact ${challenge.initiatingUser.mention} for more information*`
            challengeEmbed.setDescription(description)
            let challengeActionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_challenge_${challenge._id}`)
                        .setLabel(`Accept`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`refuse_challenge_${challenge._id}`)
                        .setLabel(`Refuse`)
                        .setStyle(ButtonStyle.Danger)
                )
            return { embeds: [challengeEmbed], components: [challengeActionRow] }
        }
    }

    async createReplyForLineup(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, lineup: ILineup, lineupQueue?: ILineupQueue): Promise<InteractionReplyOptions> {
        if (lineup.isMix() || lineup.isPicking) {
            const challenge = await matchmakingService.findChallengeByChannelId(interaction.channelId)
            let challengingLineup
            if (challenge) {
                challengingLineup = await teamService.retrieveLineup(challenge.initiatingTeam.lineup.channelId)
            }
            return this.createReplyForMixLineup(lineup, challengingLineup)
        }

        if (lineup.isCaptains()) {
            return this.createReplyForCaptainsLineup(lineup)
        }

        return this.createReplyForTeamLineup(lineup, lineupQueue)
    }

    createCaptainsPickComponent(roles: IRole[]): ActionRowBuilder<ButtonBuilder>[] {
        const captainActionsComponents = []
        let i = 0
        for (let role of roles) {
            if (!role.user) {
                continue
            }

            if (i % 5 === 0) {
                captainActionsComponents.push(new ActionRowBuilder<ButtonBuilder>())
            }

            let playerName = role.user.name.substring(0, 60)
            if (role.name.includes('GK')) {
                playerName += ' (GK)'
            }
            captainActionsComponents[captainActionsComponents.length - 1].addComponents(
                new ButtonBuilder()
                    .setCustomId(`pick_${role.user.id}_${i}`)
                    .setLabel(playerName)
                    .setStyle(ButtonStyle.Primary)
            )
            i++
        }

        return captainActionsComponents
    }

    async replyNotAllowed(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction): Promise<void> {
        await interaction.reply({ content: '⛔ You are not allowed to execute this command', ephemeral: true })
    }

    async createStatsEmbeds(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, userId: string, region?: string): Promise<EmbedBuilder[]> {
        const user = interaction.client.users.resolve(userId)
        const foundStats = await statsService.findStats(userId, region)
        let stats: IStats
        if (foundStats.length === 0) {
            stats = {
                _id: new Types.ObjectId(),
                userId,
                region: 'Europe',
                numberOfGames: 0,
                numberOfRankedGames: 0
            }
        } else {
            stats = foundStats[0]
        }

        return [
            new EmbedBuilder()
                .setColor('#566573')
                .setTitle(`${region ? '⛺ Region' : '🌎 Global'} Stats`)
                .setDescription(`Ranked Games are matches played with a format of 5v5 or more\n${user?.toString()}`)
                .addFields([
                    { name: '🏆 Ranked Games Played', value: stats.numberOfRankedGames.toString() },
                    { name: '⚽ Total Games Played', value: stats.numberOfGames.toString() }
                ])
        ]
    }

    async createLeaderBoardEmbeds(interaction: ButtonInteraction | CommandInteraction | SelectMenuInteraction, numberOfPages: number, searchOptions: any = {}): Promise<EmbedBuilder[]> {
        const { region, page = 0, pageSize = DEFAULT_LEADERBOARD_PAGE_SIZE } = searchOptions
        let allStats = await statsService.findStats(undefined, region, page, pageSize)
        let statsEmbed
        if (allStats.length === 0) {
            statsEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle('🏆 Games Leaderboard 🏆')
                .addFields([{ name: 'Ooooof', value: 'This looks pretty empty here. Time to get some games lads !' }])
        } else {
            statsEmbed = new EmbedBuilder()
                .setColor('#566573')
                .setTitle('🏆 Games Leaderboard 🏆')
            let playersStats = ''
            let pos = (pageSize * page) + 1
            for (let stats of allStats) {
                let [user] = await handle(interaction.client.users.fetch(stats._id.toString()))
                const username = user ? user.username : '*deleted user*'
                let emoji = ''
                if (pos === 1) {
                    emoji = '🥇'
                } else if (pos === 2) {
                    emoji = '🥈'
                } else if (pos === 3) {
                    emoji = '🥉'
                }
                let isTop3 = pos <= 3
                playersStats += `${isTop3 ? '**' : ''}${pos}. ${emoji} ${username} - ${stats.numberOfRankedGames} *(${stats.numberOfGames})* ${emoji}${isTop3 ? '**' : ''}\n`
                pos++
            }

            statsEmbed.addFields([{ name: `Page ${page + 1}/${numberOfPages}`, value: playersStats }])
        }

        statsEmbed.setDescription(
            `Stats are displayed in the following way: 'Player - RankedGames *(TotalGames)*'
        Ranked Games are matches played with a format of 5v5 or more.

        **${region ? '⛺ Region' : '🌎 Global'} Stats**`
        )

        return [statsEmbed]
    }

    createLeaderBoardPaginationComponent(searchOptions: any = {}, numberOfPages: number): ActionRowBuilder<ButtonBuilder> {
        const { statsType, page } = searchOptions
        const paginationActionsRow = new ActionRowBuilder<ButtonBuilder>()
        paginationActionsRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_first_page_${statsType}`)
                .setLabel('<<')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`leaderboard_page_${statsType}_${page - 1}`)
                .setLabel('<')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`leaderboard_page_${statsType}_${page + 1}`)
                .setLabel('>')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= numberOfPages - 1),
            new ButtonBuilder()
                .setCustomId(`leaderboard_last_page_${statsType}`)
                .setLabel('>>')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= numberOfPages - 1)
        )

        return paginationActionsRow
    }

    createLineupEmbed(rolesWithDiscordUsers: RoleWithDiscordUser[], opponentLineup?: ILineup): EmbedBuilder {
        let lineupEmbed = new EmbedBuilder()
            .setColor('#6aa84f')
            .setTitle(opponentLineup ? `Lineup against ${teamService.formatTeamName(opponentLineup)}` : `${rolesWithDiscordUsers[0].role.lineupNumber === 1 ? 'Red' : 'Blue'} Team lineup`)

        let description = ''
        rolesWithDiscordUsers.map(roleWithDiscordUser => {
            const role = roleWithDiscordUser.role
            const discordUser = roleWithDiscordUser.discordUser
            description += `**${role.name}:** ${role.user?.emoji || ''} ${role.user?.name || ''}`
            if (discordUser) {
                description += ` *(${discordUser})*`
            }
            description += '\n'
        })
        lineupEmbed.setDescription(description)

        return lineupEmbed
    }

    createInformationEmbed(author: User, description: string): EmbedBuilder {
        return new EmbedBuilder()
            .setColor('#566573')
            .setTimestamp()
            .setDescription(description)
            .setFooter({ text: `Author: ${author.username}` })
    }

    async createBanListEmbed(client: Client, guildId: string): Promise<EmbedBuilder> {
        const banListEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`Matchmaking Bans`)
        const bans = await teamService.findBansByGuildId(guildId)

        if (bans.length === 0) {
            banListEmbed.setDescription("✅ No user is banned")
        } else {
            for (let ban of bans) {
                const [user] = await handle(client.users.fetch(ban.userId))
                if (!user) {
                    continue
                }
                let bansEmbedFieldValue = '*Permanent*'
                if (ban.expireAt) {
                    bansEmbedFieldValue = ban.expireAt.toUTCString()
                }
                if (ban.reason) {
                    bansEmbedFieldValue += `***(Reason: ${ban.reason})***`
                }
                banListEmbed.addFields([{ name: user.username, value: bansEmbedFieldValue }])
            }
        }

        return banListEmbed
    }

    createLineupComponents(lineup: ILineup, lineupQueue?: ILineupQueue, challenge?: IChallenge, selectedLineupNumber: number = 1): ActionRowBuilder<ButtonBuilder>[] {
        const actionRows = this.createRolesActionRows(lineup, selectedLineupNumber)

        const lineupActionsRow = new ActionRowBuilder<ButtonBuilder>()
        if (!lineup.isMix()) {
            if (challenge) {
                if (challenge.initiatingTeam.lineup.channelId === lineup.channelId) {
                    lineupActionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`cancel_challenge_${challenge._id}`)
                            .setLabel(`Cancel Challenge`)
                            .setStyle(ButtonStyle.Danger)
                    )
                } else {
                    lineupActionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_challenge_${challenge._id}`)
                            .setLabel(`Accept`)
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`refuse_challenge_${challenge._id}`)
                            .setLabel(`Refuse`)
                            .setStyle(ButtonStyle.Danger)
                    )
                }
            } else {
                if (lineupQueue) {
                    lineupActionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`stopSearch`)
                            .setLabel(`Stop search`)
                            .setStyle(ButtonStyle.Danger)
                    )
                } else {
                    lineupActionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`startSearch`)
                            .setLabel('Search')
                            .setDisabled(!matchmakingService.isLineupAllowedToJoinQueue(lineup))
                            .setStyle(ButtonStyle.Success)
                    )
                }
            }

            lineupActionsRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`leaveLineup`)
                    .setLabel(`Leave`)
                    .setStyle(ButtonStyle.Danger)
            )
        }

        const numberOfSignedPlayers = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber).filter(role => role.user != null).length
        const numberOfMissingPlayers = lineup.size - numberOfSignedPlayers

        lineupActionsRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`bench_${selectedLineupNumber}`)
                .setLabel('Sign Bench')
                .setDisabled(numberOfSignedPlayers === 0)
                .setStyle(ButtonStyle.Primary)
        )

        if (!challenge) {
            lineupActionsRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`clearRole_${selectedLineupNumber}`)
                    .setLabel("Clear a position")
                    .setDisabled(numberOfSignedPlayers === 0)
                    .setStyle(ButtonStyle.Secondary)
            )
            lineupActionsRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`addMerc_${selectedLineupNumber}`)
                    .setLabel('Sign another player')
                    .setDisabled(numberOfMissingPlayers === 0)
                    .setStyle(ButtonStyle.Secondary)
            )
        }

        actionRows.push(lineupActionsRow)

        return actionRows
    }

    createRolesActionRows(lineup: ILineup, selectedLineupNumber = 1, isBench: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
        const roles = lineup.roles.filter(role => role.lineupNumber === selectedLineupNumber)
        const attackerRoles = roles.filter(role => role.type === ROLE_ATTACKER)
        const midfielderRoles = roles.filter(role => role.type === ROLE_MIDFIELDER)
        const defenderRoles = roles.filter(role => role.type === ROLE_DEFENDER)
        const gkRole = roles.filter(role => role.type === ROLE_GOAL_KEEPER)

        const maxRolePos = Math.max(
            Math.max(...attackerRoles.map(role => role.pos)),
            Math.max(...midfielderRoles.map(role => role.pos)),
            Math.max(...defenderRoles.map(role => role.pos)),
            Math.max(...gkRole.map(role => role.pos))
        )

        let rolesActionRows: ActionRowBuilder<ButtonBuilder>[] = []
        if (attackerRoles.length > 0) {
            rolesActionRows.push(this.createRoleActionRow(maxRolePos, attackerRoles, isBench))
        }

        if (midfielderRoles.length > 0) {
            rolesActionRows.push(this.createRoleActionRow(maxRolePos, midfielderRoles, isBench))
        }

        if (defenderRoles.length > 0) {
            rolesActionRows.push(this.createRoleActionRow(maxRolePos, defenderRoles, isBench))
        }

        if (gkRole.length > 0) {
            rolesActionRows.push(this.createRoleActionRow(maxRolePos, gkRole, isBench))
        }

        return rolesActionRows
    }

    private createRoleActionRow(maxRolePos: number, roles: IRole[], isBench: boolean = false): ActionRowBuilder<ButtonBuilder> {
        let actionRow = new ActionRowBuilder<ButtonBuilder>()
        for (let pos = 0; pos <= maxRolePos; pos++) {
            const role = roles.find(role => role.pos === pos)
            if (role) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${isBench ? 'benchRole' : 'role'}_${role.name}_${role.lineupNumber}`)
                        .setLabel(role.name)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(isBench ? !role.user : role.user != null)
                )
            } else {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${pos}_${Math.random()}`)
                        .setLabel('\u200b')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                )
            }
        }
        return actionRow
    }

    private async createReplyForTeamLineup(lineup: ILineup, lineupQueue?: ILineupQueue): Promise<InteractionReplyOptions> {
        const challenge = await matchmakingService.findChallengeByChannelId(lineup.channelId) || undefined

        const lineupEmbed = new EmbedBuilder()
            .setTitle(`${teamService.formatTeamName(lineup)} Lineup`)
            .setColor('#566573')

        this.fillLineupEmbedWithRoles(lineupEmbed, lineup.roles, lineup.bench)
        const components = this.createLineupComponents(lineup, lineupQueue, challenge)

        return { embeds: [lineupEmbed], components }
    }

    private createReplyForMixLineup(lineup: ILineup, challengingLineup?: ILineup | null): InteractionReplyOptions {
        let firstLineupEmbed = new EmbedBuilder()
            .setColor('#ed4245')
            .setTitle(`Red Team`)
        this.fillLineupEmbedWithRoles(firstLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 1), lineup.bench.filter(benchRole => benchRole.roles[0].lineupNumber === 1))

        let secondLineupEmbed
        if (challengingLineup) {
            secondLineupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`:vs:`)
            let fieldValue = challengingLineup.roles.filter(role => role.user != null).length + ' players signed'
            if (!teamService.hasGkSigned(challengingLineup)) {
                fieldValue += ' **(no GK)**'
            }
            secondLineupEmbed.addFields([{ name: teamService.formatTeamName(challengingLineup, false), value: fieldValue }])
        } else {
            secondLineupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Blue Team`)
                .setFooter({ text: 'If a Team faces the mix, it will replace the Blue Team' })
            this.fillLineupEmbedWithRoles(secondLineupEmbed, lineup.roles.filter(role => role.lineupNumber === 2), lineup.bench.filter(benchRole => benchRole.roles[0].lineupNumber === 2))
        }

        const lineupActionsComponent = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`mix_lineup_1`)
                .setLabel(`Red Team`)
                .setStyle(ButtonStyle.Danger)
        )

        if (!challengingLineup) {
            lineupActionsComponent.addComponents(
                new ButtonBuilder()
                    .setCustomId(`mix_lineup_2`)
                    .setLabel(`Blue Team`)
                    .setStyle(ButtonStyle.Primary)
            )
        }

        lineupActionsComponent.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaveLineup`)
                .setLabel(`Leave`)
                .setStyle(ButtonStyle.Secondary)
        )

        return { embeds: [firstLineupEmbed, secondLineupEmbed], components: [lineupActionsComponent] }
    }

    private createReplyForCaptainsLineup(lineup: ILineup): InteractionReplyOptions {
        let lineupEmbed = new EmbedBuilder()
            .setColor('#ed4245')
            .setTitle(`Player Queue`)
        this.fillLineupEmbedWithRoles(lineupEmbed, lineup.roles, lineup.bench)

        const numberOfOutfieldUsers = lineup.roles.filter(role => !role.name.includes('GK') && role.user).length
        const numberOfGkUsers = lineup.roles.filter(role => role.name.includes('GK') && role.user).length
        const lineupActionsComponent = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`leaveQueue`)
                .setLabel(`Leave`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`join_outfield`)
                .setLabel(`Join`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(numberOfOutfieldUsers === lineup.size * 2 - 2),
            new ButtonBuilder()
                .setCustomId(`join_gk`)
                .setLabel(`Join as GK`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(numberOfGkUsers === 2))

        return { embeds: [lineupEmbed], components: [lineupActionsComponent] }
    }

    private fillLineupEmbedWithRoles(lineupEmbed: EmbedBuilder, roles: IRole[], bench: IRoleBench[]): void {
        let description = roles.map(role => `**${role.name}:** ${this.formatPlayerName(role.user)}`).join('\n')

        if (bench.length > 0) {
            description += '\n\n*Bench: '
            description += bench.map(benchRole => `${this.formatPlayerName(benchRole.user)} (${benchRole.roles.map(role => role.name).join(', ')})`).join(', ')
            description += '*\n'
        }

        lineupEmbed.setDescription(description)
    }

    private formatPlayerName(user?: IUser) {
        let playerName = ''
        if (user) {
            if (user.emoji) {
                playerName += user.emoji
            }
            playerName += user.name
        } else {
            playerName = '\u200b'
        }

        return playerName
    }
}

export const interactionUtils = new InteractionUtils()