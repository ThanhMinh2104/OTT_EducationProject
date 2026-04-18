import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';

// Singleton socket instance dùng chung toàn app
const socket: Socket = io(API_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

export default socket;
