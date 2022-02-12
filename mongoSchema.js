const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    }
})
exports.Team = mongoose.model('Team', teamSchema, 'teams')

const lineupSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    roles: {
        type: [
            {
                name: {
                    type: String,
                    required: true
                },
                type: {
                    type: Number,
                    required: true
                },
                user: {
                    type: Object,
                    required: false
                },
                lineupNumber: {
                    type: Number,
                    required: true
                }
            }
        ],
        required: true
    },
    name: {
        type: String,
        required: false,
        default: ""
    },
    autoSearch: {
        type: Boolean,
        required: false,
        default: false
    },
    team: {
        type: teamSchema,
        required: true
    },
    type: {
        type: String,
        enum: ['TEAM', 'MIX', 'CAPTAINS']
    },
    visibility: {
        type: String,
        enum: ['PUBLIC', 'TEAM'],
        default: 'PUBLIC'
    },
    isPicking: {
        type: Boolean,
        required: true,
        default: false
    },
    lastNotificationTime: {
        type: Date,
        required: false
    }
})
lineupSchema.index({ channelId: 1 });
lineupSchema.methods.isMix = function () {
    return this.type === 'MIX'
}
lineupSchema.methods.isCaptains = function () {
    return this.type === 'CAPTAINS'
}
lineupSchema.methods.isMixOrCaptains = function () {
    return this.isMix() || this.isCaptains()
}
lineupSchema.methods.numberOfSignedPlayers = function () {
    return this.roles.filter(role => role.lineupNumber === 1).filter(role => role.user != null).length
}
exports.Lineup = mongoose.model('Lineup', lineupSchema, 'lineups')

const lineupQueueSchema = new mongoose.Schema({
    lineup: {
        type: lineupSchema,
        required: true
    },
    reserved: {
        type: Boolean,
        required: true,
        default: false
    },
    notificationMessages: {
        type: [{
            channelId: {
                type: String,
                required: true
            },
            messageId: {
                type: String,
                required: true
            }
        }],
        required: false
    }
})
exports.LineupQueue = mongoose.model('LineupQueue', lineupQueueSchema, 'lineup-queues')

const challengeSchema = new mongoose.Schema({
    initiatingUser: {
        type: Object,
        required: true
    },
    initiatingTeam: {
        type: lineupQueueSchema
    },
    initiatingMessageId: {
        type: String,
        required: true
    },
    challengedTeam: {
        type: lineupQueueSchema,
    },
    challengedMessageId: {
        type: String,
        required: true
    }
})
exports.Challenge = mongoose.model('Challenge', challengeSchema, 'challenges')

const statsSchema = new mongoose.Schema({
    region: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    lineupSize: {
        type: Number,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    numberOfGames: {
        type: Number,
        required: true,
        default: 0
    }
})
exports.Stats = mongoose.model('Stats', statsSchema, 'stats')

const bansSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    expireAt: {
        type: Date,
        required: false
    }
})
bansSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
bansSchema.index({ userId: 1, guildId: 1 });
exports.Bans = mongoose.model('Bans', bansSchema, 'bans')