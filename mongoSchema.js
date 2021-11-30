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
exports.PlayerRole = mongoose.model('PlayerRole', playerRoleSchema)

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
exports.Lineup = mongoose.model('Lineup', lineupSchema)

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
exports.LineupQueue = mongoose.model('LineupQueue', lineupQueueSchema, 'lineup-queue')