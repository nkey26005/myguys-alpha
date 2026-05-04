const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Простая база данных в памяти для Alpha 1.1
let messages = [];
let users = new Map();

app.get('/', (req, res) => {
  res.render('index', { version: '1.1' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    users.set(socket.id, username);
    socket.username = username;
    
    socket.emit('message', {
      type: 'system',
      text: `Добро пожаловать в MyGuys Alpha 1.1, ${username}!`
    });
    
    io.emit('user joined', username);
  });

  socket.on('chat message', (msg) => {
    const messageData = {
      username: socket.username || 'Anonymous',
      text: msg,
      time: new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})
    };
    messages.push(messageData);
    if (messages.length > 200) messages.shift();
    io.emit('chat message', messageData);
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      io.emit('user left', username);
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 MyGuys Messenger **Alpha 1.1** running on http://localhost:' + PORT);
});
