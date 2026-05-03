import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

// In-memory storage
let messages = [];
let users = new Map(); // socket.id -> username

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Main page
app.get('/', (req, res) => {
  res.render('index', { title: 'MyGuys Messenger' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join with username
  socket.on('join', (username) => {
    users.set(socket.id, username);
    socket.broadcast.emit('user_joined', { username, timestamp: new Date() });
    
    // Send previous messages
    socket.emit('previous_messages', messages.slice(-50));
  });

  // Handle new message
  socket.on('send_message', (data) => {
    const username = users.get(socket.id) || 'Anonymous';
    const message = {
      id: Date.now(),
      username: username,
      text: data.text,
      timestamp: new Date()
    };
    
    messages.push(message);
    
    // Broadcast to all
    io.emit('new_message', message);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      socket.broadcast.emit('user_left', { username });
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 MyGuys Messenger Alpha 1.0 running on http://localhost:${PORT}`);
});