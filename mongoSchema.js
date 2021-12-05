const mongoose = require('mongoose')

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

const playerRoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    user: {
        type: Object,
        required: false
    }
})

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
        type: [playerRoleSchema],
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
    }
})
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