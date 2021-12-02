const { Permissions } = require("discord.js")

exports.BOT_ADMIN_ROLE = 'PSO MM BOT ADMIN'

exports.isAllowedToExecuteCommand = (command, member) => {
    console.log(command.authorizedRoles)
    return !command.authorizedRoles
        || member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)
        || member.roles.cache.some(role => command.authorizedRoles.includes(role.name) === true)
}