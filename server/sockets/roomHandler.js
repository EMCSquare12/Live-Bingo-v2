const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');
const { generateBingoCard, calculateRemaining, checkWin } = require('../utils/bingoGame');


module.exports = (io, socket) => {

    // --- CREATE ROOM ---
    socket.on('create_room', async ({ hostName, winningPattern }) => {
        try {
            // Generate a short 6-char Room Code
            const roomId = uuidv4().substring(0, 6).toUpperCase();

            // Create the Host Player Object
            const hostPlayer = {
                socketId: socket.id,
                name: hostName,
                isHost: true,
                cardMatrix: []
            };

            // Save to MongoDB
            const newRoom = new Room({
                roomId,
                winningPattern,
                hostSocketId: socket.id,
                players: [hostPlayer]
            });

            await newRoom.save();

            // Join the Socket Room
            socket.join(roomId);

            // Tell the Client success
            socket.emit('room_created', { roomId, player: hostPlayer });

            console.log(`Room ${roomId} created by ${hostName}`);

        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not create room');
        }
    });

    // --- JOIN ROOM ---
    socket.on('join_room', async ({ roomId, playerName }) => {
        try {
            const room = await Room.findOne({ roomId });

            if (!room) {
                return socket.emit('error', 'Room not found');
            }

            // Check if Game Started (Spectator Mode logic)
            if (room.status === 'playing') {
                socket.join(roomId);
                socket.emit('spectator_joined', {
                    gameState: room,
                    message: 'Game in progress. You are spectating.'
                });
                return;
            }

            // Create Player
            const newPlayer = {
                socketId: socket.id,
                name: playerName,
                cardMatrix: generateBingoCard(),
                isHost: false
            };

            // Add to DB
            room.players.push(newPlayer);
            await room.save();

            // Join Socket Room
            socket.join(roomId);

            // Tell the specific user they joined
            socket.emit('room_joined', {
                roomId,
                player: newPlayer,
                playersList: room.players
            });

            // Notify everyone else in the room (to update their sidebar)
            io.to(roomId).emit('update_player_list', room.players);

        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not join room');
        }
    });

    // DISCONNECT
    socket.on('disconnect', async () => {
        // Delay the cleanup by 5 seconds to allow page reloads to reconnect
        setTimeout(async () => {
            // Check if this specific socket ID is STILL recorded in the database
            // If the user reconnected via rejoin_room, their socketId in the DB would have updated to a new one!
            const room = await Room.findOne({
                $or: [{ hostSocketId: socket.id }, { "players.socketId": socket.id }]
            });

            if (room) {
                // CASE A: HOST LEFT (and didn't reconnect)
                if (room.hostSocketId === socket.id) {
                    await Room.deleteOne({ _id: room._id });
                    io.to(room.roomId).emit('room_destroyed', 'Host ended the session.');
                    const sockets = await io.in(room.roomId).fetchSockets();
                    sockets.forEach(s => s.disconnect(true));
                }
                // CASE B: PLAYER LEFT (and didn't reconnect)
                else {
                    room.players = room.players.filter(p => p.socketId !== socket.id);
                    await room.save();
                    // Update Host's list
                    io.to(room.hostSocketId).emit('update_player_list', room.players);
                }
            }
        }, 5000); // 5000ms = 5 seconds grace period
    });

    // --- REJOIN ROOM (After Refresh) ---
    socket.on("rejoin_room", async ({ roomId, player }) => {
        try {
            // 1. Find the existing room
            const room = await Room.findOne({ roomId });
            if (!room) {
                return socket.emit('error', 'Room not found. It may have been closed.');
            }

            // 2. Find the specific player (fallback to matching by name if _id is missing)
            const existingPlayer = room.players.find(p => 
                (player._id && p._id.toString() === player._id) || p.name === player.name
            );

            if (existingPlayer) {
                // 3. Update the DB with their brand new Socket ID
                existingPlayer.socketId = socket.id;
                
                if (existingPlayer.isHost) {
                    room.hostSocketId = socket.id;
                }

                await room.save();

                // 4. Re-add them to the Socket.io room channel
                socket.join(roomId);

                // 5. Fire events to sync their local state
                socket.emit("room_joined", { 
                    roomId, 
                    player: existingPlayer, 
                    playersList: room.players 
                });

                // Update everyone else's sidebar
                io.to(roomId).emit("update_player_list", room.players);

                // 6. Restore Game State if a game was active
                if (room.status === 'playing') {
                    socket.emit('game_started', { status: 'playing' });
                    
                    // Sync up the current rolled numbers
                    if (room.currentNumber) {
                        socket.emit('number_rolled', {
                            number: room.currentNumber,
                            history: room.numbersDrawn
                        });
                    }
                } else if (room.status === 'ended') {
                    socket.emit('game_over', { winner: room.winner || "Someone" });
                }

                console.log(`[Rejoin] ${existingPlayer.name} reconnected to ${roomId}`);
            } else {
                socket.emit('error', 'Player session not found in this room.');
            }

        } catch (err) {
            console.error('Rejoin error:', err);
            socket.emit('error', 'Could not rejoin room');
        }
    });

    socket.on('start_game', async ({ roomId }) => {
        try {
            const room = await Room.findOne({ roomId });
            if (!room || room.hostSocketId !== socket.id) return;

            room.status = 'playing';

            // Ensure everyone has a fresh card if they don't already
            room.players.forEach(player => {
                if (player.cardMatrix.length === 0 && !player.isHost) {
                    player.cardMatrix = generateBingoCard();
                }
            });

            await room.save();
            io.to(roomId).emit('game_started', { status: 'playing' });
        } catch (err) {
            console.error(err);
        }
    });

    // HOST ROLLS NUMBER
    socket.on('roll_number', async ({ roomId }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.hostSocketId !== socket.id) return;

        // Generate a number 1-75 that isn't in room.numbersDrawn
        let nextNum;
        do {
            nextNum = Math.floor(Math.random() * 75) + 1;
        } while (room.numbersDrawn.includes(nextNum) && room.numbersDrawn.length < 75);

        if (room.numbersDrawn.length >= 75) {
            return socket.emit('error', 'All numbers called!');
        }

        room.currentNumber = nextNum;
        room.numbersDrawn.push(nextNum);
        await room.save();

        // Broadcast to everyone
        io.to(roomId).emit('number_rolled', {
            number: nextNum,
            history: room.numbersDrawn
        });
    });

    // PLAYER MARKS CARD
    socket.on('mark_number', async ({ roomId, number, cellIndex }) => {
        // cellIndex is 0-24
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // VALIDATION:
        // Is the number actually drawn?
        if (!room.numbersDrawn.includes(number)) {
            return socket.emit('action_error', "That number hasn't been called yet!");
        }

        // Does the player actually have this number at this index?
        const row = Math.floor(cellIndex / 5);
        const col = cellIndex % 5;
        if (player.cardMatrix[row][col] !== number) {
            return socket.emit('action_error', "Cheating detected! Number mismatch.");
        }

        // Mark it if not already marked
        if (!player.markedIndices.includes(cellIndex)) {
            player.markedIndices.push(cellIndex);

            // CALCULATE "BEST REMAINING" FOR HOST UI
            const remaining = calculateRemaining(player.markedIndices, room.winningPattern);

            // Save & Notify Host
            await room.save();

            // Only send this update to the Host (to save bandwidth)
            io.to(room.hostSocketId).emit('update_player_progress', {
                playerId: player._id, // or socketId
                remaining: remaining
            });

            socket.emit('mark_success', { cellIndex });
        }
    });

    // SHUFFLE CARD (Waiting Room Only)
    socket.on('request_shuffle', async ({ roomId }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.status !== 'waiting') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
            player.cardMatrix = generateBingoCard();
            await room.save();
            socket.emit('card_shuffled', player.cardMatrix);
        }
    });

    // KICK PLAYER
    socket.on('kick_player', async ({ roomId, targetSocketId }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.hostSocketId !== socket.id) return;

        // Remove from DB
        room.players = room.players.filter(p => p.socketId !== targetSocketId);
        await room.save();

        // Notify Room (update lists)
        io.to(roomId).emit('update_player_list', room.players);

        // Force Disconnect the specific user
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            targetSocket.emit('room_destroyed', 'You were kicked by the host.');
            targetSocket.disconnect(true);
        }
    });

    // UPDATE PATTERN (Before game starts)
    socket.on('update_pattern', async ({ roomId, pattern }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.status !== 'waiting') return;

        room.winningPattern = pattern;
        await room.save();
    });

    // CLAIM BINGO
    socket.on('claim_bingo', async ({ roomId }) => {
        const room = await Room.findOne({ roomId });
        if (!room) return;
        const player = room.players.find(p => p.socketId === socket.id);

        const hasWon = checkWin(player.markedIndices, room.winningPattern);

        if (hasWon) {
            room.status = 'ended';
            room.winner = player.name;
            await room.save();

            io.to(roomId).emit('game_over', {
                winner: player.name,
                winningCard: player.cardMatrix
            });
        } else {
            // Public shame for false bingo
            io.to(roomId).emit('false_bingo', { name: player.name });
        }
    });

    // RESTART GAME (Host Only)
    socket.on('restart_game', async ({ roomId }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.hostSocketId !== socket.id) return;

        // Reset State
        room.status = 'waiting';
        room.numbersDrawn = [];
        room.currentNumber = null;
        room.winner = null;

        // Reset Players
        room.players.forEach(p => {
            p.markedIndices = [12];
            p.cardMatrix = generateBingoCard();
        });

        await room.save();
        io.to(roomId).emit('game_reset', {
            message: 'New Game Started!',
            players: room.players
        });
    });
};