const { Permissions } = require("discord.js");
const { Bans } = require("../mongoSchema")

exports.BOT_ADMIN_ROLE = 'EUSL MM ADMIN'

exports.isBotAllowed = (interaction) => {
    return interaction.channel.type === 'GUILD_TEXT'
        && interaction.channel.permissionsFor(interaction.guild.me).has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES])
}

exports.isAllowedToExecuteCommand = async (command, member) => {
    return !command.authorizedRoles
        || member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
        || member.roles.cache.some(role => command.authorizedRoles.includes(role.name.toUpperCase()) === true)
}
