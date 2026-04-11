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
import { registerMessageEvents } from './socket/messageEvents'; // ⭐ Import message events

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

// MongoDB
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

app.use('/api', userRoutes);
app.use('/api', sessionRoutes);
app.use('/api', adminRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ⭐ Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  // Tham gia phòng cá nhân
  socket.on('join_user', (userID: string) => {
    socket.join(userID);
    console.log(`🧍 ${socket.id} joined user room: ${userID}`);
  });

  // Tham gia phòng chat
  socket.on('join_chat', (chatID: string) => {
    socket.join(chatID);
    console.log(`💬 ${socket.id} joined chat room: ${chatID}`);
  });

  // ⭐ Đăng ký tất cả message events (TV2)
  registerMessageEvents(io, socket);

  // User status events (giữ nguyên)
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
