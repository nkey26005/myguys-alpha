const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.static('public')); // для будущих стилей/картинок

// Главная страница
app.get('/', (req, res) => {
  const room = req.query.room || 'общий';
  res.render('index', { room });
});

// Хранение пользователей по комнатам
const rooms = {}; // например: rooms['пацаны'] = { user1: socket, user2: socket }

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  let currentRoom = 'общий';
  let nickname = 'Аноним';

  // Присоединение к комнате
  socket.on('joinRoom', ({ room, nick }) => {
    // Выходим из старой комнаты
    if (currentRoom && rooms[currentRoom]) {
      socket.leave(currentRoom);
      delete rooms[currentRoom][socket.id];
      socket.to(currentRoom).emit('userLeft', `${nickname} вышел из чата`);
      io.to(currentRoom).emit('updateUsers', Object.values(rooms[currentRoom] || {}).map(s => s.nickname));
    }

    // Входим в новую
    currentRoom = room;
    nickname = nick || 'Аноним';

    socket.nickname = nickname;
    socket.currentRoom = currentRoom;

    // Создаём комнату если нет
    if (!rooms[currentRoom]) rooms[currentRoom] = {};

    rooms[currentRoom][socket.id] = socket;
    socket.join(currentRoom);

    // Уведомления и список юзеров
    socket.to(currentRoom).emit('userJoined', `${nickname} зашёл в чат`);
    io.to(currentRoom).emit('updateUsers', Object.values(rooms[currentRoom]).map(s => s.nickname));

    // Отправляем историю (пока пустую, потом добавим)
    socket.emit('chatHistory', []);
  });

  // Сообщение
  socket.on('chatMessage', (msg) => {
    if (!socket.currentRoom) return;
    const data = { nickname, message: msg };
    io.to(socket.currentRoom).emit('chatMessage', data);
  });

  // Печатает
  socket.on('typing', (isTyping) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('typing', { nickname, isTyping });
  });

  // Отключение
  socket.on('disconnect', () => {
    if (socket.currentRoom && rooms[socket.currentRoom]) {
      delete rooms[socket.currentRoom][socket.id];
      socket.to(socket.currentRoom).emit('userLeft', `${nickname} вышел из чата`);
      io.to(socket.currentRoom).emit('updateUsers', Object.values(rooms[socket.currentRoom]).map(s => s.nickname));
    }
    console.log('Отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`My Guys alpha 1.1 запущен на http://localhost:${PORT}`);
});