import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } from "discord.js";
import { interactionUtils, matchmakingService, teamService } from "../../beans";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ILineupQueue } from "../../mongoSchema";

export default {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Display the teams looking for a match, with the same lineup size'),
    async execute(interaction: CommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineup = await teamService.retrieveLineup(interaction.channelId)
        if (!lineup) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        if (lineup.isMixOrCaptains()) {
            await interaction.reply({ content: '⛔ Mix lineups cannot see the list of challenges', ephemeral: true })
            return
        }

        await interaction.deferReply()
        let lineupQueues = await matchmakingService.findAvailableLineupQueues(team.region, lineup.channelId, lineup.size, team.guildId)
        if (lineupQueues.length === 0) {
            await interaction.editReply({
                embeds: [
                    new MessageEmbed()
                        .setColor('#566573')
                        .setDescription(`No Team is currently seaching for a ${lineup.size}v${lineup.size} match 😪`)
                ]
            })
            return
        }

        const teamLineupsEmbed = new MessageEmbed()
            .setColor('#5865f2')
            .setTitle(`Teams for ${lineup.size}v${lineup.size}`)
        const teamLineupQueues = lineupQueues.filter((lineupQueue: ILineupQueue) => !lineupQueue.lineup.isMix())
        let teamsActionComponents: MessageActionRow[] = []
        if (teamLineupQueues.length === 0) {
            teamLineupsEmbed.setDescription(`No Team available for ${lineup.size}v${lineup.size}`)
        } else {
            for (let lineupQueue of teamLineupQueues) {
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no GK)**'
                }
                teamLineupsEmbed.addField(teamService.formatTeamName(lineupQueue.lineup, false), lineupFieldValue)
            }
            let teamsActionRow = new MessageActionRow()
            if (teamLineupQueues.length < 6) {
                for (let lineupQueue of teamLineupQueues) {
                    teamsActionRow.addComponents(
                        new MessageButton()
                            .setCustomId(`challenge_${lineupQueue._id}`)
                            .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                            .setStyle('PRIMARY')
                    )
                }
            } else {
                const challengesSelectMenu = new MessageSelectMenu()
                    .setCustomId(`select_challenge`)
                    .setPlaceholder('Select a Team to challenge')
                for (let lineupQueue of teamLineupQueues) {
                    challengesSelectMenu.addOptions([{ label: teamService.formatTeamName(lineupQueue.lineup, true), value: lineupQueue._id.toString() }])
                }
                teamsActionRow.addComponents(challengesSelectMenu)
            }
            teamsActionComponents = [teamsActionRow]
        }

        const mixLineupsEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle(`Mixes for ${lineup.size}v${lineup.size}`)
        const mixLineupQueues = lineupQueues.filter((lineupQueue: ILineupQueue) => lineupQueue.lineup.isMix())
        let mixesActionComponents: MessageActionRow[] = []
        if (mixLineupQueues.length === 0) {
            mixLineupsEmbed.setDescription(`No Mix available for ${lineup.size}v${lineup.size}`)
        } else {
            for (let lineupQueue of mixLineupQueues) {
                let lineupFieldValue = lineupQueue.lineup.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length + ' players signed'
                if (!teamService.hasGkSigned(lineupQueue.lineup)) {
                    lineupFieldValue += ' **(no GK)**'
                }
                mixLineupsEmbed.addField(teamService.formatTeamName(lineupQueue.lineup, false), lineupFieldValue)
            }
            let mixesActionRow = new MessageActionRow()
            if (mixLineupQueues.length < 6) {
                for (let lineupQueue of mixLineupQueues) {
                    mixesActionRow.addComponents(
                        new MessageButton()
                            .setCustomId(`challenge_${lineupQueue._id}`)
                            .setLabel(teamService.formatTeamName(lineupQueue.lineup, true))
                            .setStyle('SECONDARY')
                    )
                }
            } else {
                const challengesSelectMenu = new MessageSelectMenu()
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
} as ICommandHandler