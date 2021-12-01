const { SlashCommandBuilder } = require('@discordjs/builders');
const { LineupQueue } = require('../mongoSchema');
const { retrieveTeam, replyTeamNotRegistered, retrieveLineup, createLineupComponents, replyAlreadyQueued } = require('../services');

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName('setup_lineup')
            .setDescription('Set the size of the team lineup to use for the selected channel')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of the team lineup')
                .addChoice('1', 1)
                .addChoice('2', 2)
                .addChoice('3', 3)
                .addChoice('4', 4)
                .addChoice('5', 5)
                .addChoice('6', 6)
                .addChoice('7', 7)
                .addChoice('8', 8)
                .addChoice('9', 9)
                .addChoice('10', 10)
                .addChoice('11', 11)
            )
            .addStringOption(option => option.setName('name')
                .setRequired(false)
                .setDescription('Sets a name for this lineup. Useful if you have multiple lineups inside your team'))
            .addBooleanOption(option => option.setName('auto_search')
                .setRequired(false)
                .setDescription('Indicates if this lineup should automatically sign into the matchmaking once it is filled')),
    async execute(interaction) {
        let team = await retrieveTeam(interaction.guildId)
        if (!team) {
            replyTeamNotRegistered(interaction)
            return
        }

        let currentQueuedLineup = await LineupQueue.findOne({ 'lineup.channelId': interaction.channelId })
        if (currentQueuedLineup) {
            replyAlreadyQueued(interaction, currentQueuedLineup.lineup.size)
            return
        }

        let lineupSize = interaction.options.getInteger("size")
        let lineup = retrieveLineup(interaction.channelId, team)
        let newPlayerRoles = generateRoles(lineupSize)
        let newLineupName = interaction.options.getString("name")
        if (lineup == null) {
            lineup = {
                channelId: interaction.channelId,
                size: lineupSize,
                roles: newPlayerRoles,
                name: newLineupName,
                autoSearch: interaction.options.getBoolean("auto_search")
            }
            team.lineups.push(lineup)
        } else {
            lineup.size = lineupSize
            lineup.roles = newPlayerRoles
            lineup.name = newLineupName
        }
        await team.save()
        await interaction.reply({ content: `✅ New lineup has now a size of ${lineupSize}`, components: createLineupComponents(lineup, interaction.user.id) });
    },
};

function generateRoles(lineupSize) {
    return defaultPlayerRoles.get(lineupSize)
}

const defaultPlayerRoles = new Map([
    [1, [{ name: 'CF' }]],
    [2, [{ name: 'GK' }, { name: 'CF' }]],
    [3, [{ name: 'GK' }, { name: 'LM' }, { name: 'RM' }]],
    [4, [{ name: 'GK' }, { name: 'LW' }, { name: 'RW' }, { name: 'CM' }]],
    [5, [{ name: 'GK' }, { name: 'CF' }, { name: 'LM' }, { name: 'RM' }, { name: 'CB' }]],
    [6, [{ name: 'GK' }, { name: 'CF' }, { name: 'LM' }, { name: 'RM' }, { name: 'LB' }, { name: 'RB' }]],
    [7, [{ name: 'GK' }, { name: 'CF' }, { name: 'LM' }, { name: 'CM' }, { name: 'RM' }, { name: 'LB' }, { name: 'RB' }]],
    [8, [{ name: 'GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'CM' }, { name: 'LB' }, { name: 'CB' }, { name: 'RB' }]],
    [9, [{ name: 'GK' }, { name: 'LF' }, { name: 'RF' }, { name: 'LM' }, { name: 'CM' }, { name: 'LM' }, { name: 'LB' }, { name: 'CB' }, { name: 'RB' }]],
    [10, [{ name: 'GK' }, { name: 'LF' }, { name: 'RF' }, { name: 'LM' }, { name: 'CM' }, { name: 'RM' }, { name: 'LB' }, { name: 'LCB' }, { name: 'RCB' }, { name: 'RB' }]],
    [11, [{ name: 'GK' }, { name: 'LW' }, { name: 'CF' }, { name: 'RW' }, { name: 'LM' }, { name: 'CM' }, { name: 'RM' }, { name: 'LB' }, { name: 'LCB' }, { name: 'RCB' }, { name: 'RB' }]]
])