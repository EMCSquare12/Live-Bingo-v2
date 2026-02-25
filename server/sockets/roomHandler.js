const Room = require("../models/Room");
const { v4: uuidv4 } = require("uuid");
const {
  generateBingoCard,
  calculateRemaining,
  checkWin,
} = require("../utils/bingoGame");

module.exports = (io, socket) => {
  // --- CREATE ROOM ---
  socket.on("create_room", async ({ hostName, winningPattern }) => {
    try {
      const roomId = uuidv4().substring(0, 6).toUpperCase();
      const hostPlayer = {
        socketId: socket.id,
        name: hostName,
        isHost: true,
        cardMatrix: [],
        markedIndices: [12],
      };

      const newRoom = new Room({
        roomId,
        winningPattern,
        hostSocketId: socket.id,
        players: [hostPlayer],
      });

      await newRoom.save();
      socket.join(roomId);

      socket.emit("room_created", {
        roomId,
        player: hostPlayer,
        room: newRoom,
      });
      console.log(`Room ${roomId} created by ${hostName}`);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not create room");
    }
  });

  // --- JOIN ROOM ---
  socket.on("join_room", async ({ roomId, playerName }) => {
    try {
      const roomCheck = await Room.findOne({ roomId });

      if (!roomCheck) {
        return socket.emit("error", "Room not found");
      }

      // Check if Game Started (Spectator Mode logic)
      if (roomCheck.status === "playing") {
        socket.join(roomId);

        const gameState = roomCheck.toObject();

        gameState.players.forEach((p) => {  
          if (!p.isHost) {
            p.remaining = calculateRemaining(
              p.markedIndices,
              gameState.winningPattern,
            );
          }
        });

        socket.emit("spectator_joined", {
          gameState: gameState,
          message: "Game in progress. You are spectating.",
        });
        return;
      }

      // Create Player
      const newPlayer = {
        socketId: socket.id,
        name: playerName,
        cardMatrix: generateBingoCard(),
        isHost: false,
        markedIndices: [12],
      };

      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId, status: { $ne: "playing" } },
        { $push: { players: newPlayer } },
        { new: true },
      );

      if (!updatedRoom) {
        return socket.emit(
          "error",
          "Could not join room right now. Game might have started.",
        );
      }

      socket.join(roomId);

      socket.emit("room_joined", {
        roomId,
        player: newPlayer,
        playersList: updatedRoom.players,
      });

      io.to(roomId).emit("update_player_list", updatedRoom.players);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not join room");
    }
  });

  // --- EXPLICIT LEAVE ROOM ---
  socket.on("leave_room", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      if (room.hostSocketId === socket.id) {
        io.to(roomId).emit(
          "room_destroyed",
          "The host has left the game. The room is now closed.",
        );
        await Room.deleteOne({ _id: room._id });

        const sockets = await io.in(roomId).fetchSockets();
        sockets.forEach((s) => s.leave(roomId));
        return;
      }

      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId },
        { $pull: { players: { socketId: socket.id } } },
        { new: true },
      );

      if (updatedRoom) {
        io.to(updatedRoom.roomId).emit(
          "update_player_list",
          updatedRoom.players,
        );
        io.to(updatedRoom.hostSocketId).emit(
          "player_left",
          "A player has left the game.",
        );

        if (updatedRoom.status === "playing") {
          updatedRoom.players.forEach((p) => {
            if (!p.isHost) {
              const remaining = calculateRemaining(
                p.markedIndices,
                updatedRoom.winningPattern,
              );
              io.to(updatedRoom.hostSocketId).emit("update_player_progress", {
                playerId: p._id,
                remaining: remaining,
              });
            }
          });
        }
      }
      socket.leave(roomId);
    } catch (err) {
      console.error("Leave room error:", err);
    }
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    setTimeout(async () => {
      try {
        const hostRoom = await Room.findOne({ hostSocketId: socket.id });
        if (hostRoom) {
          await Room.deleteOne({ _id: hostRoom._id });
          io.to(hostRoom.roomId).emit(
            "room_destroyed",
            "The host has disconnected. The room is now closed.",
          );
          const sockets = await io.in(hostRoom.roomId).fetchSockets();
          sockets.forEach((s) => s.leave(hostRoom.roomId));
          return;
        }

        const updatedRoom = await Room.findOneAndUpdate(
          { "players.socketId": socket.id },
          { $pull: { players: { socketId: socket.id } } },
          { new: true },
        );

        if (updatedRoom) {
          io.to(updatedRoom.roomId).emit(
            "update_player_list",
            updatedRoom.players,
          );
          io.to(updatedRoom.hostSocketId).emit(
            "player_left",
            "A player disconnected.",
          );
        }
      } catch (err) {
        console.error("Disconnect cleanup error:", err);
      }
    }, 3000);
  });

  // --- REJOIN ROOM ---
  socket.on("rejoin_room", async ({ roomId, player }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room)
        return socket.emit(
          "room_destroyed",
          "Room not found. It may have been closed.",
        );

      const existingPlayer = room.players.find(
        (p) =>
          (player._id && p._id.toString() === player._id) ||
          p.name === player.name,
      );

      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        if (existingPlayer.isHost) room.hostSocketId = socket.id;

        await room.save();
        socket.join(roomId);

        socket.emit("room_joined", {
          roomId,
          player: existingPlayer,
          playersList: room.players,
        });
        io.to(roomId).emit("update_player_list", room.players);

        if (room.status === "playing") {
          socket.emit("game_started", {
            status: "playing",
            winners: room.winners || [],
          });

          if (room.currentNumber) {
            socket.emit("number_rolled", {
              number: room.currentNumber,
              history: room.numbersDrawn,
            });
          }

          room.players.forEach((p) => {
            if (!p.isHost) {
              const remaining = calculateRemaining(
                p.markedIndices,
                room.winningPattern,
              );
              io.to(room.hostSocketId).emit("update_player_progress", {
                playerId: p._id,
                remaining: remaining,
              });
            }
          });
        }
      } else {
        socket.emit(
          "session_expired",
          "Player session not found in this room.",
        );
      }
    } catch (err) {
      console.error("Rejoin error:", err);
      socket.emit("error", "Could not rejoin room");
    }
  });

  // --- START GAME ---
  socket.on("start_game", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.hostSocketId !== socket.id) return;

      room.status = "playing";

      room.players.forEach((player) => {
        if (player.cardMatrix.length === 0 && !player.isHost) {
          player.cardMatrix = generateBingoCard();
        }
      });

      await room.save();
      io.to(roomId).emit("game_started", {
        status: "playing",
        winners: room.winners || [],
      });
    } catch (err) {
      console.error(err);
    }
  });

  // --- HOST ROLLS NUMBER ---
  socket.on("roll_number", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * 75) + 1;
    } while (
      room.numbersDrawn.includes(nextNum) &&
      room.numbersDrawn.length < 75
    );

    if (room.numbersDrawn.length >= 75)
      return socket.emit("error", "All numbers called!");

    room.currentNumber = nextNum;
    room.numbersDrawn.push(nextNum);
    await room.save();

    io.to(roomId).emit("number_rolled", {
      number: nextNum,
      history: room.numbersDrawn,
    });
  });

  // --- PLAYER MARKS CARD ---
  socket.on("mark_number", async ({ roomId, number, cellIndex }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    if (!room.numbersDrawn.includes(number)) {
      return socket.emit("action_error", "That number hasn't been called yet!");
    }

    const row = Math.floor(cellIndex / 5);
    const col = cellIndex % 5;
    if (player.cardMatrix[row][col] !== number) {
      return socket.emit("action_error", "Cheating detected! Number mismatch.");
    }

    if (!player.markedIndices.includes(cellIndex)) {
      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId, "players.socketId": socket.id },
        { $addToSet: { "players.$.markedIndices": cellIndex } },
        { new: true },
      );

      if (updatedRoom) {
        const updatedPlayer = updatedRoom.players.find(
          (p) => p.socketId === socket.id,
        );
        const remaining = calculateRemaining(
          updatedPlayer.markedIndices,
          updatedRoom.winningPattern,
        );

        io.to(updatedRoom.hostSocketId).emit("update_player_progress", {
          playerId: updatedPlayer._id,
          remaining: remaining,
        });

        socket.emit("mark_success", { cellIndex });
      }
    }
  });

  // --- SHUFFLE CARD ---
  socket.on("request_shuffle", async ({ roomId }) => {
    try {
      const newMatrix = generateBingoCard();
      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId, status: "waiting", "players.socketId": socket.id },
        { $set: { "players.$.cardMatrix": newMatrix } },
        { new: true },
      );

      if (updatedRoom) {
        socket.emit("card_shuffled", newMatrix);
      }
    } catch (err) {
      console.error("Shuffle error:", err);
      socket.emit("error", "Could not shuffle card");
    }
  });

  // --- KICK PLAYER ---
  socket.on("kick_player", async ({ roomId, targetSocketId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    room.players = room.players.filter((p) => p.socketId !== targetSocketId);
    await room.save();

    io.to(roomId).emit("update_player_list", room.players);

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit("room_destroyed", "You were kicked by the host.");
      targetSocket.disconnect(true);
    }
  });

  // --- UPDATE PATTERN ---
  socket.on("update_pattern", async ({ roomId, pattern }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId: roomId, hostSocketId: socket.id, status: "waiting" },
        { $set: { winningPattern: pattern } },
      );
    } catch (err) {
      console.error("Update pattern error:", err);
    }
  });

  // --- CLAIM BINGO ---
  socket.on("claim_bingo", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);

    if (room.winners && room.winners.includes(player.name)) return;

    const hasWon = checkWin(player.markedIndices, room.winningPattern);

    if (hasWon) {
      // Safely register multiple winners without stopping the game
      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId, winners: { $ne: player.name } },
        { $push: { winners: player.name } },
        { new: true },
      );

      if (updatedRoom) {
        io.to(roomId).emit("player_won", {
          winner: player.name,
          winners: updatedRoom.winners,
          rank: updatedRoom.winners.length,
        });
      }
    } else {
      io.to(roomId).emit("false_bingo", { name: player.name });
    }
  });

  // --- RESTART GAME ---
  socket.on("restart_game", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    room.status = "waiting";
    room.numbersDrawn = [];
    room.currentNumber = null;
    room.winners = [];

    room.players.forEach((p) => {
      p.markedIndices = [12];
      p.cardMatrix = generateBingoCard();
    });

    await room.save();
    io.to(roomId).emit("game_reset", {
      message: "New Game Started!",
      players: room.players,
    });
  });
};
