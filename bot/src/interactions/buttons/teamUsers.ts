import { ButtonInteraction, Message, TextChannel, User } from "discord.js";
import { MAX_TEAM_CAPTAINS, MAX_TEAM_PLAYERS } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { teamService, TeamTypeHelper } from "../../services/teamService";
import { userService } from "../../services/userService";
import { handle } from "../../utils";

export default {
    customId: 'team_users_',
    async execute(interaction: ButtonInteraction) {
        const split = interaction.customId.split('_')
        const action = split[2]
        const category = split[3]
        const guildId = split[4]

        let team: ITeam = await teamService.findTeamByGuildId(guildId) as ITeam
        const teamWasVerified = team.verified
        let teamChanged = false
        const regionGuild = await regionService.getRegionGuild(interaction.client, team.region)
        await interaction.update({ content: `Type the ids or the mentions (@user) of the users you want to ${action}\nType **end** once you have finished.`, components: [] })
        const filter = (m: Message) => interaction.user.id === m.author.id
        const collector = (interaction.channel as TextChannel).createMessageCollector({ filter, time: 20000 });
        collector.on('collect', async m => {
            collector.resetTimer()

            if (m.content === 'end') {
                collector.stop()
                return
            }

            if (action === 'add') {
                if (category === 'captains' && team.captains.length >= MAX_TEAM_CAPTAINS) {
                    await interaction.followUp({ content: '⛔ This team has reached the maximum number of captains', ephemeral: true })
                    return
                }
                if (category === 'players' && team.players.length >= MAX_TEAM_PLAYERS) {
                    await interaction.followUp({ content: '⛔ This team has reached the maximum number of players', ephemeral: true })
                    return
                }
            }

            let discordUser: User | undefined
            if (m.mentions.users.size === 1) {
                discordUser = m.mentions.users.first()
            } else if (regionService.isRegionalDiscord(interaction.guildId!)) {
                [discordUser] = await handle(interaction.client.users.fetch(m.content))
            }

            if (!discordUser) {
                await interaction.followUp({ content: '⛔ This user does not exist', ephemeral: true })
                return
            }

            if (discordUser.bot) {
                await interaction.followUp({ content: '⛔ I know I am the best, but I am not allowed to play, sorry :(', ephemeral: true })
                return
            }

            const user = await userService.findUserByDiscordUserId(discordUser.id)
            if (action === 'add') {
                if (!user) {
                    await interaction.followUp({ content: '⛔ This user is not registered into PSO Matchmaker', ephemeral: true })
                    return
                }

                const userTeams = await teamService.findTeams(discordUser.id)
                if (userTeams.filter(t => t.guildId !== guildId).filter(t => t.type === team.type).length > 0) {
                    await interaction.followUp({ content: `⛔ This player already belongs to another ${TeamTypeHelper.toString(team.type)}`, ephemeral: true })
                    return
                }
            }

            teamChanged = true
            if (category === 'captains') {
                if (action === 'add') {
                    if (team.captains.some(captain => captain.id === discordUser!.id)) {
                        await interaction.followUp({ content: '⛔ This user is already captain', ephemeral: true })
                        return
                    }
                    team = (await teamService.addCaptain(guildId, user!))!
                    await regionService.addTeamCodeToNickname(discordUser.id, team, regionGuild)
                } else {
                    team = (await teamService.removeCaptain(guildId, discordUser.id))!
                    await regionService.removeTeamCodeFromNickName(discordUser.id, regionGuild)
                }
            } else {
                if (action === 'add') {
                    if (team.players.some(player => player.id === discordUser!.id)) {
                        await interaction.followUp({ content: '⛔ This user is already a player', ephemeral: true })
                        return
                    }
                    team = (await teamService.addPlayer(guildId, user!))!
                    await regionService.addTeamCodeToNickname(discordUser.id, team, regionGuild)
                } else {
                    team = (await teamService.removePlayer(guildId, discordUser.id))!
                    await regionService.removeTeamCodeFromNickName(discordUser.id, regionGuild)
                }
            }
            await interaction.followUp({ content: `${category === 'captains' ? 'Captain' : 'Player'} ${discordUser} successfully ${action === 'add' ? 'added' : 'removed'}` })
        })

        collector.on('end', async () => {
            if (teamChanged) {
                await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
                if (teamWasVerified) {
                    teamService.notifyNoLongerVerified(interaction.client, team, 'Players/captains modifications')
                }
            } else {
                await interaction.followUp({ content: "Captains edition timed out...", ephemeral: true })
            }
        })
    }
} as IButtonHandler