import mongoose from 'mongoose'

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
const PlayerRole = mongoose.model('PlayerRole', playerRoleSchema)

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
const Lineup = mongoose.model('Lineup', lineupSchema)

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
const Team = mongoose.model('Team', teamSchema, 'teams')

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
    }
})
const LineupQueue = mongoose.model('LineupQueue', lineupQueueSchema, 'lineup-queue')

export { Team }
export { Lineup }
export { LineupQueue } 
export { PlayerRole} 