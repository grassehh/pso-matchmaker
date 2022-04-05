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
    challengeId: {
        type: String,
        required: false
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

const matchSchema = new mongoose.Schema({
    matchId: {
        type: String,
        required: true
    },
    schedule: {
        type: Date,
        required: true
    },
    firstLineup: {
        type: lineupSchema,
        required: true
    },
    secondLineup: {
        type: lineupSchema,
        required: false
    },
    lobbyName: {
        type: String,
        required: true
    },
    lobbyPassword: {
        type: String,
        required: true
    },
    subs: {
        type: [
            {
                user: {
                    type: Object,
                    required: true
                }
            }
        ],
        required: true
    },
})
matchSchema.index({ schedule: 1 }, { expireAfterSeconds: 4 * 60 * 60 });
matchSchema.methods.findUserRole = function (user) {
    const existingUserInSubs = this.subs.filter(role => role.user).find(role => role.user.id === user.id)
    const existingUserInFirstLineup = this.firstLineup.roles.filter(role => role.user).find(role => role.user.id === user.id)
    let existingUserInSecondLineup
    if (this.secondLineup) {
        existingUserInSecondLineup = this.secondLineup.roles.filter(role => role.user).find(role => role.user.id === user.id)
    }
    return [existingUserInSubs, existingUserInFirstLineup, existingUserInSecondLineup].find(user => user)
}
exports.Match = mongoose.model('Match', matchSchema, 'matches')

const statsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    numberOfGames: {
        type: Number,
        required: true
    },
    numberOfRankedGames: {
        type: Number,
        required: true
    }
})
exports.Stats = mongoose.model('Stats', statsSchema, 'stats')
statsSchema.index({ userId: 1, region: 1 });
statsSchema.index({ region: 1 });

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