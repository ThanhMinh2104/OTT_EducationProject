import dotenv from 'dotenv';
dotenv.config();

// Bắt lỗi toàn cục để tránh sập Server đột ngột
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL ERROR (uncaughtException):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL ERROR (unhandledRejection):', reason);
});

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';

import userRoutes from './routes/userRoutes';
import sessionRoutes from './routes/sessionRoutes';
import adminRoutes from './routes/adminRoutes';
import chatRoutes, { getChatsForUser } from './routes/chatRoutes';
import reminderRoutes from './routes/reminderRoutes';
import groupReminderRoutes from './routes/groupReminderRoutes';
import groupRoutes from './routes/groupRoutes';
import groupMediaRoutes from './routes/groupMediaRoutes';
import filePreviewRoutes from './routes/filePreview';
import { registerMessageEvents } from './socket/messageEvents';
import { registerNotificationEvents } from './socket/notificationEvents';
import { registerCallEvents, getActiveCallsMap, clearActiveCallsMap } from './socket/index';
import { registerGroupChatEvents } from './socket/groupChatEvents';
import { registerGroupCallEvents } from './socket/groupCallEvents';

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
app.use('/api/reminders', reminderRoutes);
app.use('/api/group-reminders', groupReminderRoutes);
app.use('/api', groupRoutes);
app.use('/api', groupMediaRoutes);
app.use('/api/files', filePreviewRoutes);

// Lưu io vào app để các routes có thể truy cập
app.set('io', io);

// Debug route để xem active calls
app.get('/api/debug/active-calls', (req, res) => {
  const calls = Array.from(getActiveCallsMap().entries()).map(([userID, info]) => ({
    userID,
    with: info.with,
    duration: Math.floor((Date.now() - info.startTime) / 1000),
  }));
  res.json({ activeCalls: calls, count: calls.length / 2 });
});

// Route để clear active calls (chỉ dùng khi debug)
app.post('/api/debug/clear-active-calls', (req, res) => {
  clearActiveCallsMap();
  res.json({ message: 'Active calls cleared' });
});

io.on('connection', (socket) => {
  // Chỉ log error, không log mỗi connection
  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 Client connected:', socket.id);
  }

  socket.on('join_user', (userID: string) => {
    socket.join(userID);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧍 ${socket.id} joined user room: ${userID}`);
    }
  });

  socket.on('join_chat', (chatID: string) => {
    socket.join(chatID);
    if (process.env.NODE_ENV === 'development') {
      console.log(`💬 ${socket.id} joined chat room: ${chatID}`);
    }
  });

  // Lấy danh sách chat của user
  socket.on('getChat', async (userID: string) => {
    try {
      // Lấy TẤT CẢ chat (bao gồm cả người lạ) để frontend tự phân loại
      const allChats = await getChatsForUser(userID, false); // Chỉ lấy bạn bè
      const strangerChats = await getChatsForUser(userID, true); // Chỉ lấy người lạ
      const combined = [...allChats, ...strangerChats];

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `📋 getChat for ${userID}: ${allChats.length} friend chats + ${strangerChats.length} stranger chats = ${combined.length} total`
        );
      }
      // Emit tới user room, không phải chỉ socket hiện tại
      io.to(userID).emit('ChatByUserID', combined);
    } catch (e) {
      console.error('getChat error:', e);
    }
  });

  // Đăng ký message events (TV2)
  registerMessageEvents(io, socket);

  // Đăng ký notification events (TV5)
  registerNotificationEvents(io, socket);

  // Đăng ký call events (WebRTC)
  registerCallEvents(io, socket);

  // Đăng ký group chat events
  registerGroupChatEvents(io, socket);

  // Đăng ký group call events
  registerGroupCallEvents(io, socket);

  socket.on('updateStatus', async (user) => {
    // Chỉ broadcast tới user room của chính họ, không broadcast toàn bộ
    io.to(user.userID).emit('userStatusUpdated', user);
    socket.broadcast.emit('userStatusUpdated', user);
  });

  socket.on('updateUser', (user: any) => {
    console.log('🔄 Socket: updateUser received (index.ts):', user);
    if (user && user.userID) {
      io.emit('userUpdated', user);
    }
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 Client disconnected:', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
