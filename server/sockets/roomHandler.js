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
      // Generate a short 6-char Room Code
      const roomId = uuidv4().substring(0, 6).toUpperCase();

      // Create the Host Player Object
      const hostPlayer = {
        socketId: socket.id,
        name: hostName,
        isHost: true,
        cardMatrix: [],
        markedIndices: [12],
      };

      // Save to MongoDB
      const newRoom = new Room({
        roomId,
        winningPattern,
        hostSocketId: socket.id,
        players: [hostPlayer],
      });

      await newRoom.save();

      // Join the Socket Room
      socket.join(roomId);

      // Tell the Client success
      socket.emit("room_created", { roomId, player: hostPlayer });

      console.log(`Room ${roomId} created by ${hostName}`);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not create room");
    }
  });

  // --- JOIN ROOM ---
  socket.on("join_room", async ({ roomId, playerName }) => {
    try {
      const room = await Room.findOne({ roomId });

      if (!room) {
        return socket.emit("error", "Room not found");
      }

      // Check if Game Started (Spectator Mode logic)
      if (room.status === "playing") {
        socket.join(roomId);
        socket.emit("spectator_joined", {
          gameState: room,
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

      // Add to DB
      room.players.push(newPlayer);
      await room.save();

      // Join Socket Room
      socket.join(roomId);

      // Tell the specific user they joined
      socket.emit("room_joined", {
        roomId,
        player: newPlayer,
        playersList: room.players,
      });

      // Notify everyone else in the room (to update their sidebar)
      io.to(roomId).emit("update_player_list", room.players);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not join room");
    }
  });

  // --- EXPLICIT LEAVE ROOM (Instant departure) ---
  socket.on("leave_room", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      // CHECK IF THE LEAVING PLAYER IS THE HOST
      if (room.hostSocketId === socket.id) {
        // Announce to all players that the host left
        io.to(roomId).emit(
          "room_destroyed",
          "The host has left the game. The room is now closed.",
        );

        // Delete the room from the database
        await Room.deleteOne({ _id: room._id });

        // Kick all players from the socket room
        const sockets = await io.in(roomId).fetchSockets();
        sockets.forEach((s) => {
          s.leave(roomId);
        });
        return; // Stop execution here for the host
      }

      // IF NOT THE HOST, remove the normal player from the room
      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId },
        { $pull: { players: { socketId: socket.id } } }, // Removes the specific player
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

        // Repopulate progress for remaining players so they don't turn to "Ready"
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

      // Remove this individual user from the Socket channel
      socket.leave(roomId);
    } catch (err) {
      console.error("Leave room error:", err);
    }
  });

  // --- DISCONNECT (3-second grace period for drops/refreshes) ---
  socket.on("disconnect", async () => {
    setTimeout(async () => {
      try {
        // Check if the socket was a HOST
        const hostRoom = await Room.findOne({ hostSocketId: socket.id });
        if (hostRoom) {
          await Room.deleteOne({ _id: hostRoom._id });

          // Announce to players
          io.to(hostRoom.roomId).emit(
            "room_destroyed",
            "The host has disconnected. The room is now closed.",
          );

          // Kick everyone out of the room
          const sockets = await io.in(hostRoom.roomId).fetchSockets();
          sockets.forEach((s) => s.leave(hostRoom.roomId));
          return;
        }

        // If not host, attempt to atomically remove the player
        const updatedRoom = await Room.findOneAndUpdate(
          { "players.socketId": socket.id },
          { $pull: { players: { socketId: socket.id } } },
          { new: true },
        );

        // If a player was successfully removed (meaning they didn't reconnect)
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
    }, 3000); // 3000ms = 3 seconds
  });

  // --- REJOIN ROOM (After Refresh) ---
  socket.on("rejoin_room", async ({ roomId, player }) => {
    try {
      // Find the existing room
      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit("error", "Room not found. It may have been closed.");
      }

      // Find the specific player (fallback to matching by name if _id is missing)
      const existingPlayer = room.players.find(
        (p) =>
          (player._id && p._id.toString() === player._id) ||
          p.name === player.name,
      );

      if (existingPlayer) {
        // Update the DB with their brand new Socket ID
        existingPlayer.socketId = socket.id;

        if (existingPlayer.isHost) {
          room.hostSocketId = socket.id;
        }

        await room.save();

        // Re-add them to the Socket.io room channel
        socket.join(roomId);

        // Fire events to sync their local state
        socket.emit("room_joined", {
          roomId,
          player: existingPlayer,
          playersList: room.players,
        });

        // Update everyone else's sidebar
        io.to(roomId).emit("update_player_list", room.players);

        // Restore Game State if a game was active
        if (room.status === "playing") {
          socket.emit("game_started", { status: "playing" });

          // Sync up the current rolled numbers
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
          // ---------------------------------------------------------
        } else if (room.status === "ended") {
          socket.emit("game_over", { winner: room.winner || "Someone" });
        }

        console.log(`[Rejoin] ${existingPlayer.name} reconnected to ${roomId}`);
      } else {
        socket.emit("error", "Player session not found in this room.");
      }
    } catch (err) {
      console.error("Rejoin error:", err);
      socket.emit("error", "Could not rejoin room");
    }
  });

  socket.on("start_game", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.hostSocketId !== socket.id) return;

      room.status = "playing";

      // Ensure everyone has a fresh card if they don't already
      room.players.forEach((player) => {
        if (player.cardMatrix.length === 0 && !player.isHost) {
          player.cardMatrix = generateBingoCard();
        }
      });

      await room.save();
      io.to(roomId).emit("game_started", { status: "playing" });
    } catch (err) {
      console.error(err);
    }
  });

  // HOST ROLLS NUMBER
  socket.on("roll_number", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    // Generate a number 1-75 that isn't in room.numbersDrawn
    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * 75) + 1;
    } while (
      room.numbersDrawn.includes(nextNum) &&
      room.numbersDrawn.length < 75
    );

    if (room.numbersDrawn.length >= 75) {
      return socket.emit("error", "All numbers called!");
    }

    room.currentNumber = nextNum;
    room.numbersDrawn.push(nextNum);
    await room.save();

    // Broadcast to everyone
    io.to(roomId).emit("number_rolled", {
      number: nextNum,
      history: room.numbersDrawn,
    });
  });

  // PLAYER MARKS CARD
  socket.on("mark_number", async ({ roomId, number, cellIndex }) => {
    // cellIndex is 0-24
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    // VALIDATION:
    // Is the number actually drawn?
    if (!room.numbersDrawn.includes(number)) {
      return socket.emit("action_error", "That number hasn't been called yet!");
    }

    // Does the player actually have this number at this index?
    const row = Math.floor(cellIndex / 5);
    const col = cellIndex % 5;
    if (player.cardMatrix[row][col] !== number) {
      return socket.emit("action_error", "Cheating detected! Number mismatch.");
    }

    // Mark it if not already marked
    if (!player.markedIndices.includes(cellIndex)) {
      // FIX: Use atomic findOneAndUpdate instead of room.save() to prevent VersionErrors
      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: roomId, "players.socketId": socket.id },
        { $addToSet: { "players.$.markedIndices": cellIndex } }, // $addToSet safely pushes to the array
        { new: true }, // Returns the document AFTER the update is applied
      );

      if (updatedRoom) {
        // Find the updated player to get their newly saved markedIndices
        const updatedPlayer = updatedRoom.players.find(
          (p) => p.socketId === socket.id,
        );

        // CALCULATE "BEST REMAINING" FOR HOST UI
        const remaining = calculateRemaining(
          updatedPlayer.markedIndices,
          updatedRoom.winningPattern,
        );

        // Only send this update to the Host (to save bandwidth)
        io.to(updatedRoom.hostSocketId).emit("update_player_progress", {
          playerId: updatedPlayer._id, // or socketId
          remaining: remaining,
        });

        socket.emit("mark_success", { cellIndex });
      }
    }
  });

  // SHUFFLE CARD (Waiting Room Only)
  socket.on("request_shuffle", async ({ roomId }) => {
    try {
      const newMatrix = generateBingoCard();

      const updatedRoom = await Room.findOneAndUpdate(
        {
          roomId: roomId,
          status: "waiting",
          "players.socketId": socket.id,
        },
        {
          $set: { "players.$.cardMatrix": newMatrix },
        },
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

  // KICK PLAYER
  socket.on("kick_player", async ({ roomId, targetSocketId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    // Remove from DB
    room.players = room.players.filter((p) => p.socketId !== targetSocketId);
    await room.save();

    // Notify Room (update lists)
    io.to(roomId).emit("update_player_list", room.players);

    // Force Disconnect the specific user
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit("room_destroyed", "You were kicked by the host.");
      targetSocket.disconnect(true);
    }
  });

  // UPDATE PATTERN (Before game starts)
  socket.on("update_pattern", async ({ roomId, pattern }) => {
    try {
      // Use findOneAndUpdate to atomically set the pattern and prevent VersionErrors
      // The query conditions automatically ensure it's the host and the game is waiting
      await Room.findOneAndUpdate(
        {
          roomId: roomId,
          hostSocketId: socket.id,
          status: "waiting",
        },
        {
          $set: { winningPattern: pattern },
        },
      );
    } catch (err) {
      console.error("Update pattern error:", err);
    }
  });

  // CLAIM BINGO
  socket.on("claim_bingo", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);

    const hasWon = checkWin(player.markedIndices, room.winningPattern);

    if (hasWon) {
      room.status = "ended";
      room.winner = player.name;
      await room.save();

      io.to(roomId).emit("game_over", {
        winner: player.name,
        winningCard: player.cardMatrix,
      });
    } else {
      // Public shame for false bingo
      io.to(roomId).emit("false_bingo", { name: player.name });
    }
  });

  // RESTART GAME (Host Only)
  socket.on("restart_game", async ({ roomId }) => {
    const room = await Room.findOne({ roomId });
    if (!room || room.hostSocketId !== socket.id) return;

    // Reset State
    room.status = "waiting";
    room.numbersDrawn = [];
    room.currentNumber = null;
    room.winner = null;

    // Reset Players
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
