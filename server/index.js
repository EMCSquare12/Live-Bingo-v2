require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const roomHandler = require("./sockets/roomHandler");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Database
connectDB();

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://live-bingo-v2.netlify.app"],
    methods: ["GET", "POST"],
  },
});

// Run Socket Logic
const onConnection = (socket) => {
  console.log(`User connected: ${socket.id}`);
  roomHandler(io, socket);
};

io.on("connection", onConnection);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
