const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  const room = req.query.room || 'general';
  res.render('index', { room });
});

const rooms = {};
const roomHistory = {};
const MAX_HISTORY_MESSAGES = 50;

function ensureRoom(roomName) {
  if (!rooms[roomName]) {
    rooms[roomName] = {};
  }
  if (!roomHistory[roomName]) {
    roomHistory[roomName] = [];
  }
}

function pushHistory(roomName, message) {
  ensureRoom(roomName);
  roomHistory[roomName].push(message);
  if (roomHistory[roomName].length > MAX_HISTORY_MESSAGES) {
    roomHistory[roomName].shift();
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let nickname = 'Anonymous';

  socket.on('joinRoom', ({ room, nick }) => {
    const nextRoom = (room || 'general').trim();
    const nextNickname = (nick || 'Anonymous').trim() || 'Anonymous';

    if (currentRoom && rooms[currentRoom]) {
      socket.leave(currentRoom);
      delete rooms[currentRoom][socket.id];

      io.to(currentRoom).emit(
        'systemMessage',
        `${nickname} left the room`
      );
      io.to(currentRoom).emit(
        'updateUsers',
        Object.values(rooms[currentRoom]).map((user) => user.nickname)
      );
    }

    ensureRoom(nextRoom);

    currentRoom = nextRoom;
    nickname = nextNickname;

    socket.nickname = nickname;
    socket.currentRoom = currentRoom;

    rooms[currentRoom][socket.id] = socket;
    socket.join(currentRoom);

    socket.emit('chatHistory', roomHistory[currentRoom]);

    socket.to(currentRoom).emit('systemMessage', `${nickname} joined the room`);
    io.to(currentRoom).emit(
      'updateUsers',
      Object.values(rooms[currentRoom]).map((user) => user.nickname)
    );
  });

  socket.on('chatMessage', (msg) => {
    const trimmedMessage = (msg || '').trim();
    if (!socket.currentRoom || !trimmedMessage) {
      return;
    }

    const data = {
      nickname,
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
    };

    pushHistory(socket.currentRoom, data);
    io.to(socket.currentRoom).emit('chatMessage', data);
  });

  socket.on('typing', (isTyping) => {
    if (!socket.currentRoom) {
      return;
    }
    socket
      .to(socket.currentRoom)
      .emit('typing', { nickname, isTyping: Boolean(isTyping) });
  });

  socket.on('disconnect', () => {
    if (socket.currentRoom && rooms[socket.currentRoom]) {
      delete rooms[socket.currentRoom][socket.id];
      socket
        .to(socket.currentRoom)
        .emit('systemMessage', `${nickname} left the room`);
      io.to(socket.currentRoom).emit(
        'updateUsers',
        Object.values(rooms[socket.currentRoom]).map((user) => user.nickname)
      );
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`My Guys Messenger v0.1 is running on http://localhost:${PORT}`);
});
