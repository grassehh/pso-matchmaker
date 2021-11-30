const { MessageActionRow, MessageButton } = require("discord.js");
const { Team } = require("./mongoSchema");

exports.retrieveTeam = async (guildId) => {
    return Team.findOne({ 'guildId': guildId })
}

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `❌ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command.`,
        ephemeral: true
    })
}

exports.replyTeamNotRegistered = async (interaction) => {
    await interaction.reply({
        content: 'Please register your team with the /register_team command first',
        ephemeral: true
    })
}

exports.retrieveLineup = (channelId, team) => {
    return team.lineups.find(lineup => lineup.channelId == channelId)
}

exports.replyLineupNotSetup = async (interaction) => {
    await interaction.reply({
        content: 'This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
        ephemeral: true
    })
}

exports.createLineupComponents = (lineup, userId) => {
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