const mongoose = require('mongoose');

// Sub-schema for individual players
const PlayerSchema = new mongoose.Schema({
    socketId: { type: String },
    name: { type: String, required: true },
    cardMatrix: [[Number]], 
    isHost: { type: Boolean, default: false },
    markedIndices: { type: [Number], default: [12] } 
});

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    hostSocketId: { type: String },

    status: {
        type: String,
        enum: ['waiting', 'playing', 'ended'],
        default: 'waiting'
    },

    numbersDrawn: { type: [Number], default: [] },
    currentNumber: { type: Number, default: null },
    winningPattern: { type: [Number], default: [] },

    players: [PlayerSchema],

    createdAt: { type: Date, default: Date.now, expires: 86400 }
});

module.exports = mongoose.model('Room', RoomSchema);