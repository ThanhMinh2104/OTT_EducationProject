import { io, Socket } from 'socket.io-client';

// Production (Vercel HTTPS) → cần WSS, phải trỏ thẳng tới EC2 có SSL
// Development → dùng VITE_API_URL hoặc fallback localhost
const SOCKET_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_SOCKET_URL || 'https://54-179-135-20.nip.io')
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

// Tạo một socket instance duy nhất để dùng chung trong toàn bộ app
const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket connection error:', error);
});

export default socket;
