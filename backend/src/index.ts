import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';

import userRoutes from './routes/userRoutes';
import sessionRoutes from './routes/sessionRoutes';
import adminRoutes from './routes/adminRoutes';
import chatRoutes, { getChatsForUser } from './routes/chatRoutes';
import { registerMessageEvents } from './socket/messageEvents';
import { registerNotificationEvents } from './socket/notificationEvents';

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✅ MongoDB Connected');
  } catch (err: any) {
    console.error('❌ MongoDB Error:', err.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use('/api', userRoutes);
app.use('/api', sessionRoutes);
app.use('/api', adminRoutes);
app.use('/api', chatRoutes(io));

io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  socket.on('join_user', (userID: string) => {
    socket.join(userID);
    console.log(`🧍 ${socket.id} joined user room: ${userID}`);
  });

  socket.on('join_chat', (chatID: string) => {
    socket.join(chatID);
    console.log(`💬 ${socket.id} joined chat room: ${chatID}`);
  });

  // Lấy danh sách chat của user
  socket.on('getChat', async (userID: string) => {
    try {
      const chats = await getChatsForUser(userID);
      socket.emit('ChatByUserID', chats);
    } catch (e) {
      console.error('getChat error:', e);
    }
  });

  // Đăng ký message events (TV2)
  registerMessageEvents(io, socket);

  // Đăng ký notification events (TV5)
  registerNotificationEvents(io, socket);

  socket.on('updateStatus', async (user) => {
    io.emit('userStatusUpdated', user);
  });

  socket.on('updateUser', (user) => {
    io.emit('userUpdated', user);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
