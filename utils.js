const { MessageMentions: { USERS_PATTERN } } = require('discord.js');

exports.handle = (promise) => {
    return promise
        .then(data => ([data, undefined]))
        .catch(error => Promise.resolve([undefined, error]));
}

exports.getUserIdFromMention = (mention) => {
    const result = USERS_PATTERN.exec(mention)
    USERS_PATTERN.lastIndex = 0
    if (!result) return
    return result[1]
}