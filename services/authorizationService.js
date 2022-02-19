const { Permissions } = require("discord.js");

exports.BOT_ADMIN_ROLE = 'PSO MM ADMIN'

exports.isBotAllowed = (interaction) => {
    return interaction.channel.type === 'GUILD_TEXT'
        && interaction.channel.permissionsFor(interaction.guild.me).has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES])
}

exports.isAllowedToExecuteCommand = (command, member) => {
    return !command.authorizedRoles
        || member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
        || member.roles.cache.some(role => command.authorizedRoles.includes(role.name.toUpperCase()) === true)
}

exports.isMatchmakingAdmin = (member) => {
    return member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
        || member.roles.cache.some(role => role.name.toUpperCase() === this.BOT_ADMIN_ROLE)
}