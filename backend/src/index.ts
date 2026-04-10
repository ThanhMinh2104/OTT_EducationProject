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

app.use('/api', userRoutes(io));

io.on('connection', (socket) => {
  socket.on('updateStatus', async (user) => {
    io.emit('userStatusUpdated', user);
  });
  socket.on('updateUser', (user) => {
    io.emit('userUpdated', user);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));