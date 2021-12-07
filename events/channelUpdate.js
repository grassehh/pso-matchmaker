const teamService = require('../services/teamService');
const matchmakingService = require('../services/matchmakingService');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel) {
        if (oldChannel.type === 'GUILD_TEXT') {
            const oldMembers = oldChannel.members
            const newMembers = newChannel.members
            if (newMembers.size < oldMembers.size && oldMembers.get(newChannel.guild.me.user.id) && !newMembers.get(newChannel.guild.me.user.id)) {
                matchmakingService.deleteChallengesByChannelId(newChannel.id)
                matchmakingService.deleteLineupQueuesByChannelId(newChannel.id)
                teamService.deleteLineup(newChannel.id)
            }
        }
    }
}