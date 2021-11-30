const { Client, Intents, MessageActionRow, MessageEmbed, MessageButton } = require('discord.js');
const mongoose = require('mongoose')
const { Team, Lineup, LineupQueue, PlayerRole } = require('./mongoSchema.js')
const dotenv = require('dotenv');

dotenv.config()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
})

client.on('ready', async () => {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })
    console.log('The bot is ready')
})

client.on('interactionCreate', async (interaction) => {
    let team = await Team.findOne({ 'guildId': interaction.guildId });

    if (interaction.isCommand()) {
        if (team == null) {
            if (interaction.commandName === 'register_team') {
                new Team({
                    guildId: interaction.guildId,
                    name: interaction.options.getString('team_name'),
                    region: interaction.options.getString('team_region')
                }).save()
                interaction.reply({
                    content: 'Your team has been registered ! You can now register lineups in your channels using the /setup_lineup command',
                    ephemeral: true
                })
            } else {
                interaction.reply({
                    content: 'Please register your team with the /register_team command first',
                    ephemeral: true
                })
            }
            return
        }

        if (interaction.commandName === 'register_team') {
            interaction.reply({
                content: `You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
            return
        }

        if (interaction.commandName === 'info') {
            const teamEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`Team information`)
                .setTimestamp()
            teamEmbed.addField('Team name', team.name)
            teamEmbed.addField('Team region', team.region)
            interaction.reply({
                embeds: [teamEmbed],
                ephemeral: true
            })
            return
        }

        if (interaction.commandName === 'team_name') {
            team.name = interaction.options.getString('name')
            team.save()
            interaction.reply({
                content: `Your new team name is ${team.name}`,
                ephemeral: true
            })
            return
        }

        /**
         * Actual matchmaking commands
         */
        let channelId = interaction.channelId
        let existingLineup = team.lineups.find(lineup => lineup.channelId == channelId)
        if (interaction.commandName == 'setup_lineup') {
            if (existingLineup == null) {
                existingLineup = new Lineup(
                    {
                        channelId: channelId,
                        size: interaction.options.getInteger("size"),
                        roles: [
                            new PlayerRole({ name: "LW" }),
                            new PlayerRole({ name: "RW" })
                        ]
                    }
                )
                team.lineups.push(existingLineup)
            } else {
                existingLineup.size = interaction.options.getInteger("size")
            }
            team.save()
            interaction.reply({ content: `Current lineup size is ${existingLineup.size}`, components: createLineupComponents(existingLineup, interaction.user.id) });
            return
        }

        if (existingLineup == null) {
            interaction.reply({
                content: 'This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
                ephemeral: true
            })
            return
        }

        switch (interaction.commandName) {
            case 'search': {
                new LineupQueue({
                    team: {
                        name: team.name,
                        region: team.region
                    },
                    lineup: existingLineup
                }).save()
                interaction.reply({
                    content: `Your team is now queued for ${existingLineup.size}v${existingLineup.size}`
                })
                break
            }
            case 'stop_search': {
                await LineupQueue.deleteOne({ 'lineup.channelId': channelId }).exec()
                interaction.reply({
                    content: `Your team is now removed from the queue`
                })
                break
            }
            case 'lineup': {
                interaction.reply({ content: `Current lineup size is ${existingLineup.size}`, components: createLineupComponents(existingLineup, interaction.user.id) });
                break
            }
            case 'clear_lineup': {
                existingLineup.roles.forEach(role => {
                    role.user = null
                });
                team.save()
                interaction.reply({ content: `Current lineup size is ${existingLineup.size}`, components: createLineupComponents(existingLineup, interaction.user.id) });
                break
            }
            case 'challenges': {
                let lineupQueues = await LineupQueue.find({$and: [{ 'lineup.channelId': { '$ne': existingLineup.channelId } }, { 'team.region': team.region }]})

                let teamsComponents = new MessageActionRow()
                const teamsEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(`Challenging Teams (Current lineup is ${existingLineup.size}v${existingLineup.size})`)
                    .setTimestamp()

                if (lineupQueues.length === 0) {
                    teamsEmbed.setDescription("No Team are currently seaching for a match")
                } else {
                    for (let lineupQueue of lineupQueues) {
                        teamsEmbed.addField(`Team '${lineupQueue.team.name}'`, `${lineupQueue.lineup.size}v${lineupQueue.lineup.size}`)
                        if (lineupQueue.lineup.size == existingLineup.size) {
                            console.log(lineupQueue.lineup.channelId)
                            teamsComponents.addComponents(
                                new MessageButton()
                                    .setCustomId(`challenge_${lineupQueue.lineup.channelId}`)
                                    .setLabel(`Challenge '${lineupQueue.team.name}'`)
                                    .setEmoji('⚽')
                                    .setStyle('PRIMARY')
                            )
                        }
                    }
                    teamsEmbed.setFooter("Note: You can only challenge team with the same lineup size")
                }

                if (teamsComponents.components.length === 0) {
                    interaction.reply({ embeds: [teamsEmbed] })
                } else {
                    interaction.reply({ embeds: [teamsEmbed], components: [teamsComponents] })
                }
            }
            default: {
                break
            }
        }

        return
    }

    if (interaction.isButton()) {
        let lineup = team.lineups.find(lineup => lineup.channelId == interaction.channelId)

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
            interaction.message.delete()
            interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
            return
        }

        if (interaction.customId === 'leaveLineup') {
            let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
            if (existingPlayerRole != null) {
                existingPlayerRole.user = null
            }
            team.save()
            interaction.message.delete()
            interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
            return
        }

        if (interaction.customId.startsWith('challenge_')) {
            let teamChannelId = interaction.customId.substring(10);
            let teamsComponents = new MessageActionRow().addComponents(
                new MessageButton()
                    .setLabel(`Challenge request sent`)
                    .setEmoji('⚽')
                    .setStyle('PRIMARY')
                    .setCustomId(`challenge_${teamChannelId}`)
                    .setDisabled(true)
            )
            interaction.message.delete()
            interaction.reply({ components: [teamsComponents] })
            return
        }
        return
    }
})

client.login(process.env.TOKEN)

function createLineupComponents(lineup, userId) {
    const positionsRow = new MessageActionRow()

    for (let playerRole of lineup.roles) {
        positionsRow.addComponents(
            new MessageButton()
                .setCustomId(`role_${playerRole.name}`)
                .setLabel(playerRole.user == null ? playerRole.name : `${playerRole.name}: ${playerRole.user.name}`)
                .setStyle('PRIMARY')
                .setDisabled(playerRole.user != null)
        )
    }

    let existingPlayerRole = lineup.roles.find(role => role.user?.id === userId)
    const lineupActionsRow = new MessageActionRow()
    lineupActionsRow.addComponents(
        new MessageButton()
            .setCustomId(`leaveLineup`)
            .setLabel(`Leave`)
            .setStyle('DANGER')
            .setDisabled(existingPlayerRole == null)
    )


    return [positionsRow, lineupActionsRow]
}