import { io, Socket } from 'socket.io-client';

// Lấy URL từ biến môi trường, fallback về localhost nếu không có
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Tạo một socket instance duy nhất để dùng chung trong toàn bộ app
const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket'], // Chỉ dùng websocket, không fallback polling
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Log kết nối
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket connection error:', error);
});

export default socket;
