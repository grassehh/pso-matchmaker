import DiscordJS, { BaseCommandInteraction, ButtonInteraction, CommandInteraction, Intents, Message, MessageActionRow, MessageButton, MessageComponentInteraction, MessageEmbed } from 'discord.js'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Team, Lineup, LineupQueue, PlayerRole } from './mongoSchema'
dotenv.config()

const client = new DiscordJS.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
})

client.on('ready', async () => {
    await mongoose.connect(process.env.MONGO_URI || '', { keepAlive: true })

    console.log('The bot is ready')

    const guild1 = client.guilds.cache.get('914820495076122685')
    // const guild2 = client.guilds.cache.get('914863087054639124')
    let commands

    if (guild1) {
        commands = guild1.commands
    } else {
        commands = client.application?.commands
    }

    commands?.create({
        name: 'info',
        description: 'Gives information about your team'
    })

    commands?.create({
        name: 'register_team',
        description: 'Registers your team against PSO matchmaker so you can start using the matchmaking',
        options: [
            {
                name: 'team_name',
                description: 'The name of your team',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'team_region',
                description: 'The region of your team',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING,
                choices: [
                    { name: "Europe", value: "EU" },
                    { name: "North America", value: "NA" },
                    { name: "South America", value: "SA" },
                    { name: "Korea", value: "AS" }
                ]
            }
        ]
    })

    commands?.create({
        name: 'team_name',
        description: 'Let you edit the name of your team',
        options: [
            {
                name: 'name',
                description: 'The new name of your team',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]

    })

    commands?.create({
        name: 'setup_lineup',
        description: 'Set the size of the team lineup to use for the selected channel.',
        options: [
            {
                name: 'size',
                description: 'The size of the team lineup',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.INTEGER,
                choices: [
                    { name: "1", value: 1 },
                    { name: "2", value: 2 },
                    { name: "3", value: 3 },
                    { name: "4", value: 4 },
                    { name: "5", value: 5 },
                    { name: "6", value: 6 },
                    { name: "7", value: 7 },
                    { name: "8", value: 8 },
                    { name: "9", value: 9 },
                    { name: "10", value: 10 },
                    { name: "11", value: 11 }
                ]
            }
        ]
    })

    commands?.create({
        name: 'search',
        description: 'Put your team in the matchmaking queue'
    })

    commands?.create({
        name: 'stop_search',
        description: 'Remove your team from the matchmaking queue'
    })

    commands?.create({
        name: 'lineup',
        description: 'Displays the current lineup'
    })

    commands?.create({
        name: 'clear_lineup',
        description: 'Clears every roles in this lineup'
    })

    commands?.create({
        name: 'challenges',
        description: 'Display the teams looking for a match, with the same lineup size'
    })
})

client.on('interactionCreate', async (interaction) => {
    let team = await Team.findOne({ 'guildId': interaction.guildId });

    if (interaction.isCommand()) {
        const commandInteraction = interaction as CommandInteraction

        if (team == null) {
            if (commandInteraction.commandName === 'register_team') {
                new Team({
                    guildId: commandInteraction.guildId,
                    name: commandInteraction.options.getString('team_name'),
                    region: commandInteraction.options.getString('team_region')
                }).save()
                commandInteraction.reply({
                    content: 'Your team has been registered ! You can now register lineups in your channels using the /setup_lineup command',
                    ephemeral: true
                })
            } else {
                commandInteraction.reply({
                    content: 'Please register your team with the /register_team command first',
                    ephemeral: true
                })
            }
            return
        }

        if (commandInteraction.commandName === 'register_team') {
            commandInteraction.reply({
                content: `You team is already registered as '${team.name}'. Use the /team_name command if you wish to change the name of your team.`,
                ephemeral: true
            })
            return
        }

        if (commandInteraction.commandName === 'info') {
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

        if (commandInteraction.commandName === 'team_name') {
            team.name = commandInteraction.options.getString('name')
            team.save()
            commandInteraction.reply({
                content: `Your new team name is ${team.name}`,
                ephemeral: true
            })
            return
        }

        /**
         * Actual matchmaking commands
         */
        let channelId = commandInteraction.channelId
        let existingLineup = team.lineups.find((lineup: { channelId: string }) => lineup.channelId == channelId)
        if (commandInteraction.commandName == 'setup_lineup') {
            if (existingLineup == null) {
                existingLineup = new Lineup(
                    {
                        channelId: channelId,
                        size: commandInteraction.options.getInteger("size"),
                        roles: [
                            new PlayerRole({ name: "LW" }),
                            new PlayerRole({ name: "RW" })
                        ]
                    }
                )
                team.lineups.push(existingLineup)
            } else {
                existingLineup.size = commandInteraction.options.getInteger("size")
            }
            team.save()
            interaction.reply({ content: `Current lineup size is ${existingLineup.size}`, components: createLineupComponents(existingLineup, interaction.user.id) });
            return
        }

        if (existingLineup == null) {
            commandInteraction.reply({
                content: 'This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
                ephemeral: true
            })
            return
        }

        switch (commandInteraction.commandName) {
            case 'search': {
                new LineupQueue({
                    team: {
                        name: team.name,
                        region: team.region
                    },
                    lineup: existingLineup
                }).save()
                commandInteraction.reply({
                    content: `Your team is now queued for ${existingLineup.size}v${existingLineup.size}`
                })
                break
            }
            case 'stop_search': {
                await LineupQueue.deleteOne({ 'lineup.channelId': channelId }).exec()
                commandInteraction.reply({
                    content: `Your team is now removed from the queue`
                })
                break
            }
            case 'lineup': {
                interaction.reply({ content: `Current lineup size is ${existingLineup.size}`, components: createLineupComponents(existingLineup, interaction.user.id) });
                break
            }
            case 'clear_lineup': {
                existingLineup.roles.forEach((role: { user: any }) => {
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
                                    .setLabel(`Challenge ${lineupQueue.teamName}`)
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
        const buttonInteraction = interaction as ButtonInteraction
        let lineup = team.lineups.find((lineup: { channelId: string }) => lineup.channelId == buttonInteraction.channelId)

        if (buttonInteraction.customId.startsWith("role_")) {
            let roleName = buttonInteraction.customId.substring(5)
            let playerRole = lineup.roles.find((role: { name: string }) => role.name == roleName)

            let existingPlayerRole = lineup.roles.find((role: { user: { id: string } }) => role.user?.id === buttonInteraction.user.id)
            if (existingPlayerRole != null) {
                existingPlayerRole.user = null
            }
            playerRole.user = {
                id: buttonInteraction.user.id,
                name: buttonInteraction.user.username,
                tag: buttonInteraction.user.toString()
            }
            team.save();
            (interaction.message as Message).delete()
            interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
            return
        }

        if (buttonInteraction.customId === 'leaveLineup') {
            let existingPlayerRole = lineup.roles.find((role: { user: { id: string } }) => role.user?.id === buttonInteraction.user.id)
            if (existingPlayerRole != null) {
                existingPlayerRole.user = null
            }
            team.save();
            (interaction.message as Message).delete()
            interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
            return
        }
        return
    }
})

client.login(process.env.TOKEN)

function createLineupComponents(lineup: any, userId: String) {
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

    let existingPlayerRole = lineup.roles.find((role: { user: { id: string } }) => role.user?.id === userId)
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