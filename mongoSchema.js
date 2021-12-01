const mongoose = require('mongoose')

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
    }
})

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
    },
    lineups: {
        type: [lineupSchema],
        required: true
    }
})
exports.Team = mongoose.model('Team', teamSchema, 'teams')

const lineupQueueSchema = new mongoose.Schema({
    team: {
        name: {
            type: String,
            required: true
        },
        region: {
            type: String,
            required: true
        }
    },
    lineup: {
        type: lineupSchema,
        required: true
    },
    reserved: {
        type: Boolean,
        required: true,
        default: false
    }
})
exports.LineupQueue = mongoose.model('LineupQueue', lineupQueueSchema, 'lineup-queues')

const challengeSchema = new mongoose.Schema({
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