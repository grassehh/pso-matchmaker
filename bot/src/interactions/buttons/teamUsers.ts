import { ButtonInteraction, Message, User } from "discord.js";
import { MAX_TEAM_CAPTAINS, MAX_TEAM_PLAYERS } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { teamService, TeamTypeHelper } from "../../services/teamService";
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

        await interaction.reply({ content: `Type the ids or the mentions (@user) of the users you want to ${action} ?\nType **end** once you have finished.`, ephemeral: true })

        let teamChanged = false
        const filter = (m: Message) => interaction.user.id === m.author.id
        const collector = interaction.channel!.createMessageCollector({ filter, time: 20000 });
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

            let user: User | undefined
            if (m.mentions.users.size === 1) {
                user = m.mentions.users.first()
            } else if (regionService.isOfficialDiscord(interaction.guildId!)) {
                [user] = await handle(interaction.client.users.fetch(m.content))
            }

            if (!user) {
                await interaction.followUp({ content: '⛔ This user does not exist', ephemeral: true })
                return
            }

            if (user.bot) {
                await interaction.followUp({ content: '⛔ I know I am the best, but I am not allowed to play, sorry :(', ephemeral: true })
                return
            }

            const userTeams = await teamService.findTeams(user.id)
            if (userTeams.filter(t => t.guildId !== guildId).filter(t => t.type === team.type).length > 0 && action === 'add') {
                await interaction.followUp({ content: `⛔ This player already belongs to another ${TeamTypeHelper.toString(team.type)}`, ephemeral: true })
                return
            }

            teamChanged = true
            if (category === 'captains') {
                if (action === 'add') {
                    if (team.captains.some(captain => captain.id === user?.id)) {
                        await interaction.followUp({ content: '⛔ This user is already captain', ephemeral: true })
                        return
                    }
                    team = (await teamService.addCaptain(guildId, { id: user.id, name: user.username, mention: user.toString() }))!
                } else {
                    team = (await teamService.removeCaptain(guildId, user.id))!
                }
            } else {
                if (action === 'add') {
                    if (team.players.some(player => player.id === user?.id)) {
                        await interaction.followUp({ content: '⛔ This user is already a player', ephemeral: true })
                        return
                    }
                    team = (await teamService.addPlayer(guildId, { id: user.id, name: user.username, mention: user.toString() }))!
                } else {
                    team = (await teamService.removePlayer(guildId, user.id))!
                }
            }
            await interaction.followUp({ content: `${category === 'captains' ? 'Captain' : 'Player'} ${user} successfully ${action === 'add' ? 'added' : 'removed'}` })
        })

        collector.on('end', async () => {
            if (teamChanged) {
                await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
                if (teamWasVerified) {
                    teamService.notifyNoLongerVerified(interaction.client, team)
                }
            } else {
                await interaction.followUp({ content: "Captains edition timed out...", ephemeral: true })
            }
        })
    }
} as IButtonHandler