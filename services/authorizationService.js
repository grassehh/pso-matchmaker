const BOT_ADMIN_ROLE = 'PSO MM BOT ADMIN'

exports.isAllowedToExecuteCommand = (member) => {
    return member.roles.cache.some(role => role.name === BOT_ADMIN_ROLE) === true
}