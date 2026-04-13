import { io, Socket } from 'socket.io-client';

// Tạo một socket instance duy nhất để dùng chung trong toàn bộ app
const socket: Socket = io('http://localhost:5000');

export default socket;
