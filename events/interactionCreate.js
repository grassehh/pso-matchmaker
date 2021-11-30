const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");
const { LineupQueue } = require("../mongoSchema");
const { retrieveTeam, retrieveLineup, createLineupComponents } = require("../services");
const { findLineupQueueById, findLineupQueueByChannelId } = require("../services/matchmakingService");
const { deleteTeam } = require("../services/teamService");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                return
            }
        }

        if (interaction.isButton()) {
            try {
                let team = await retrieveTeam(interaction.guildId)
                let lineup = await retrieveLineup(interaction.channelId, team)

                if (interaction.customId.startsWith("role_")) {
                    let roleName = interaction.customId.substring(5)
                    let playerRole = lineup.roles.find(role => role.name == roleName)

                    let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                    if (existingPlayerRole != null) {
                        existingPlayerRole.user = null
                    }
                    playerRole.user = {
                        id: interaction.user.id,
                        name: interaction.user.username,
                        tag: interaction.user.toString()
                    }
                    team.save()
                    await interaction.message.edit({ components: [] })
                    await interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId === 'leaveLineup') {
                    let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                    if (existingPlayerRole != null) {
                        existingPlayerRole.user = null
                    }
                    team.save()
                    await interaction.message.edit({ components: [] })
                    await interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
                    return
                }

                if (interaction.customId.startsWith('challenge_')) {
                    let lineupQueueId = interaction.customId.substring(10);
                    let opponentLineupQueue = await findLineupQueueById(lineupQueueId)
                    let channel = await interaction.client.channels.fetch(opponentLineupQueue.lineup.channelId)
                    const challengeEmbed = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle(`Team ${team.name} is challenging you for a ${opponentLineupQueue.lineup.size}v${opponentLineupQueue.lineup.size} match !`)
                        .setDescription('Please ACCEPT or REFUSE the challenge.')
                        .setTimestamp()

                    let challengeActionRow = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId(`challenge_yes_${team.id}`)
                                .setLabel(`Accept`)
                                .setStyle('SUCCESS'),
                            new MessageButton()
                                .setCustomId(`challenge_no_${team.id}`)
                                .setLabel(`Refuse`)
                                .setStyle('DANGER')
                        )

                    await channel.send({ embeds: [challengeEmbed], components: [challengeActionRow] })
                    await interaction.message.edit({ components: [] })
                    await interaction.reply(`💬 You have sent a challenge request to the team '${opponentLineupQueue.team.name}'. Please wait for his answer.`)
                    return
                }

                if (interaction.customId.startsWith('delete_team_yes_')) {
                    await deleteTeam(interaction.guildId);
                    await interaction.reply({ content: '✅ Your team has been deleted', ephemeral: true })
                    return
                }

                if (interaction.customId.startsWith('delete_team_no_')) {
                    await interaction.reply({ content: 'Easy peasy ! Nothing has been deleted', ephemeral: true })
                    return
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
            }
        }
    }
}