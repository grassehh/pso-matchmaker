const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");

exports.replyAlreadyQueued = async (interaction, lineupSize) => {
    await interaction.reply({
        content: `❌ You are already queued for ${lineupSize}v${lineupSize}. Please use the /stop_search command before using this command.`,
        ephemeral: true
    })
}

exports.replyTeamNotRegistered = async (interaction) => {
    await interaction.reply({
        content: '❌ Please register your team with the /register_team command first',
        ephemeral: true
    })
}

exports.replyAlreadyChallenging = async (interaction, challenge) => {
    await interaction.reply({
        content: `❌ Your team is negotiating a challenge between the teams '${challenge.initiatingTeam.team.name}' and '${challenge.initiatingTeam.team.name}'`,
        ephemeral: true
    })
}

exports.replyLineupNotSetup = async (interaction) => {
    await interaction.reply({
        content: '❌ This channel has no lineup configured yet. Use the /setup_lineup command to choose a lineup format',
        ephemeral: true
    })
}

exports.createCancelChallengeReply = (challenge) => {
    let cancelChallengeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`cancel_challenge_${challenge.id}`)
                .setLabel(`Cancel Request`)
                .setStyle('DANGER')
        )
    return { content: `💬 You have sent a challenge request to the team '${challenge.challengedTeam.team.name}'. You can either wait for his answer, or cancel your request.`, components: [cancelChallengeRow] }
}

exports.createDecideChallengeReply = (challenge) => {
    const challengeEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Team '${challenge.initiatingTeam.team.name}' is challenging you for a ${challenge.initiatingTeam.lineup.size}v${challenge.initiatingTeam.lineup.size} match !`)
        .setDescription(`Contact ${challenge.initiatingUser.mention} if you want to arrange further.`)
        .setTimestamp()
    let challengeActionRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`accept_challenge_${challenge.id}`)
                .setLabel(`Accept`)
                .setStyle('SUCCESS'),
            new MessageButton()
                .setCustomId(`refuse_challenge_${challenge.id}`)
                .setLabel(`Refuse`)
                .setStyle('DANGER')
        )
    return { embeds: [challengeEmbed], components: [challengeActionRow] }
}

exports.createLineupReply = (lineup, userId) => {
    return { content: `Current lineup size is ${lineup.size}`, components: this.createLineupComponents(lineup, userId) }
}

exports.createLineupComponents = (lineup, userId) => {

    let components = []
    for (var i = 0; i < lineup.roles.length; i++) {
        if (i % 4 === 0) {
            components.push(new MessageActionRow())
        }

        let playerRole = lineup.roles[i]
        components[components.length - 1].addComponents(
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
    components.push(lineupActionsRow)

    return components
}