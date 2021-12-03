const { Permissions } = require("discord.js")

exports.BOT_ADMIN_ROLE = 'PSO MM ADMIN'

exports.isAllowedToExecuteCommand = (command, member) => {
    return !command.authorizedRoles
        || member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
        || member.roles.cache.some(role => command.authorizedRoles.includes(role.name.toUpperCase()) === true)
}