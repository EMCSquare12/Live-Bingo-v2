const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');
const { generateBingoCard, calculateRemaining, checkWin } = require('../utils/bingoGame');

module.exports = (io, socket) => {

    // --- CREATE ROOM ---
    socket.on('create_room', async ({ hostName, winningPattern }) => {
        try {
            const roomId = uuidv4().substring(0, 6).toUpperCase();

            const hostPlayer = {
                socketId: socket.id,
                name: hostName,
                isHost: true,
                cardMatrix: []
            };

            const newRoom = new Room({
                roomId,
                winningPattern,
                hostSocketId: socket.id,
                players: [hostPlayer]
            });

            await newRoom.save();
            socket.join(roomId);

            const savedRoom = await Room.findOne({ roomId });
            const savedHost = savedRoom.players[0];

            socket.emit('room_created', { roomId, player: savedHost });
            console.log(`Room ${roomId} created by ${hostName}`);

        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not create room');
        }
    });

    // --- JOIN ROOM (Handles New Joins AND Reconnections) ---
    socket.on('join_room', async ({ roomId, playerName, playerId }) => {
        try {
            const room = await Room.findOne({ roomId });

            if (!room) {
                return socket.emit('error', 'Room not found');
            }

            // RECONNECTION ATTEMPT
            if (playerId) {
                const existingPlayer = room.players.find(p => p._id.toString() === playerId);
                
                if (existingPlayer) {
                    // Update the socket ID to the new connection
                    existingPlayer.socketId = socket.id;
                    
                    // If it was the host, update the main host reference
                    if (existingPlayer.isHost) {
                        room.hostSocketId = socket.id;
                    }

                    await room.save();
                    socket.join(roomId);

                    // Restore client state
                    socket.emit('room_joined', {
                        roomId,
                        player: existingPlayer,
                        playersList: room.players
                    });
                    
                    // If game is playing, ensure they get current game state
                    if (room.status === 'playing') {
                        socket.emit('game_started', { status: 'playing' });
                        socket.emit('number_rolled', { 
                            number: room.currentNumber, 
                            history: room.numbersDrawn 
                        });
                    }
                    
                    return;
                }
            }

            // NEW PLAYER LOGIC
            if (room.status === 'playing') {
                socket.join(roomId);
                socket.emit('spectator_joined', {
                    gameState: room,
                    message: 'Game in progress. You are spectating.'
                });
                return;
            }

            const newPlayer = {
                socketId: socket.id,
                name: playerName,
                cardMatrix: generateBingoCard(),
                isHost: false
            };

            room.players.push(newPlayer);
            await room.save();
            socket.join(roomId);

            // Get the saved player to ensure we have the _id
            const updatedRoom = await Room.findOne({ roomId });
            const savedPlayer = updatedRoom.players.find(p => p.socketId === socket.id);

            socket.emit('room_joined', {
                roomId,
                player: savedPlayer,
                playersList: updatedRoom.players
            });

            io.to(roomId).emit('update_player_list', updatedRoom.players);

        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not join room');
        }
    });

    // --- LEAVE ROOM (Explicit Action) ---
    socket.on('leave_room', async ({ roomId, playerId }) => {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // If Host leaves explicitly, destroy room
        if (room.hostSocketId === socket.id) {
            await Room.deleteOne({ _id: room._id });
            io.to(roomId).emit('room_destroyed', 'Host ended the session.');
            const sockets = await io.in(roomId).fetchSockets();
            sockets.forEach(s => s.disconnect(true));
        } else {
            // Player leaves explicitly
            room.players = room.players.filter(p => p.socketId !== socket.id);
            await room.save();
            io.to(room.hostSocketId).emit('player_left', { socketId: socket.id });
            io.to(roomId).emit('update_player_list', room.players);
        }
    });

    // --- DISCONNECT (Handle unexpected closes/reloads) ---
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    
    socket.on('start_game', async ({ roomId }) => {
        try {
            const room = await Room.findOne({ roomId });
            if (!room || room.hostSocketId !== socket.id) return;

            room.status = 'playing';
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

        io.to(roomId).emit('number_rolled', {
            number: nextNum,
            history: room.numbersDrawn
        });
    });

    // PLAYER MARKS CARD
    socket.on('mark_number', async ({ roomId, number, cellIndex }) => {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (!room.numbersDrawn.includes(number)) {
            return socket.emit('action_error', "That number hasn't been called yet!");
        }

        const row = Math.floor(cellIndex / 5);
        const col = cellIndex % 5;
        if (player.cardMatrix[row][col] !== number) {
            return socket.emit('action_error', "Cheating detected! Number mismatch.");
        }

        if (!player.markedIndices.includes(cellIndex)) {
            player.markedIndices.push(cellIndex);
            const remaining = calculateRemaining(player.markedIndices, room.winningPattern);
            await room.save();

            io.to(room.hostSocketId).emit('update_player_progress', {
                playerId: player._id, 
                remaining: remaining
            });

            socket.emit('mark_success', { cellIndex });
        }
    });

    // SHUFFLE CARD
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

        room.players = room.players.filter(p => p.socketId !== targetSocketId);
        await room.save();

        io.to(roomId).emit('update_player_list', room.players);

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            targetSocket.emit('room_destroyed', 'You were kicked by the host.');
            targetSocket.disconnect(true);
        }
    });

    // UPDATE PATTERN
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
            io.to(roomId).emit('false_bingo', { name: player.name });
        }
    });

    // RESTART GAME
    socket.on('restart_game', async ({ roomId }) => {
        const room = await Room.findOne({ roomId });
        if (!room || room.hostSocketId !== socket.id) return;

        room.status = 'waiting';
        room.numbersDrawn = [];
        room.currentNumber = null;
        room.winner = null;

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