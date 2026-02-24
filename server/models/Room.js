const mongoose = require("mongoose");

// Sub-schema for individual players
const PlayerSchema = new mongoose.Schema({
  socketId: { type: String }, // Updates on reconnect
  name: { type: String, required: true },
  cardMatrix: [[Number]], // 5x5 Grid
  isHost: { type: Boolean, default: false },
  // Track which indices (0-24) the player has marked
  markedIndices: { type: [Number], default: [] },
});

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostSocketId: { type: String },

  // Game Status
  status: {
    type: String,
    enum: ["waiting", "playing", "ended"],
    default: "waiting",
  },

  // Game Data
  numbersDrawn: { type: [Number], default: [] },
  currentNumber: { type: Number, default: null },
  winningPattern: { type: [Number], default: [] },

  players: [PlayerSchema],

  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

module.exports = mongoose.model("Room", RoomSchema);
