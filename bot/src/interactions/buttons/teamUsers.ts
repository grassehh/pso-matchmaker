import { ButtonInteraction, Message, User } from "discord.js";
import { MAX_TEAM_CAPTAINS, MAX_TEAM_PLAYERS } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ITeam } from "../../mongoSchema";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import { handle } from "../../utils";

export default {
    customId: 'team_users_',
    async execute(interaction: ButtonInteraction) {
        const split = interaction.customId.split('_')
        const action = split[2]
        const category = split[3]
        const guildId = split[4]

        let team: ITeam = await teamService.findTeamByGuildId(guildId) as ITeam

        await interaction.reply({ content: `Type the ids or the mentions (@user) of the users you want to ${action} ?\nType **end** once you have finished.`, ephemeral: true })

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
            } else if (authorizationService.isOfficialDiscord(interaction.guildId!)) {
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

            const userTeam = await teamService.findTeamFromUserId(user.id)
            if (userTeam && userTeam.guildId !== interaction.guildId && action === 'add') {
                await interaction.followUp({ content: `⛔ This player already belongs to **${userTeam.name}**`, ephemeral: true })
                return
            }

            if (category === 'captains') {
                if (action === 'add') {
                    team = (await teamService.addCaptain(guildId, { id: user.id, name: user.username, mention: user.toString() }))!
                } else {
                    team = (await teamService.removeCaptain(guildId, user.id))!
                }
            } else {
                if (action === 'add') {
                    team = (await teamService.addPlayer(guildId, { id: user.id, name: user.username, mention: user.toString() }))!
                } else {
                    team = (await teamService.removePlayer(guildId, user.id))!
                }
            }
            await interaction.followUp({ content: `${category === 'captains' ? 'Captain' : 'Player'} ${user} successfully ${action === 'add' ? 'added' : 'removed'}` })
        })

        collector.on('end', async () => {
            await interaction.followUp({ content: "✅ Captains edition finished", components: [], ephemeral: true })
            if (team) {
                team = await teamService.verify(team.guildId, false) as ITeam
                await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
            }
        })
    }
} as IButtonHandler