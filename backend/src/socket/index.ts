import { Server, Socket } from 'socket.io';

export const socketHandler = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('🟢 Client connected:', socket.id);

    // Tham gia phòng cá nhân
    socket.on('join_user', (userID: string) => {
      socket.join(userID);
      console.log(`🧍 ${socket.id} joined user room: ${userID}`);
    });

    socket.on('join_user', (userID: string) => {
      socket.join(userID);
      console.log(`🧍 ${socket.id} joined user room: ${userID}`);
    });

    //WebRTC signaling
    socket.on('call-user', (data: { to: string; offer: any; from: string; callerInfo: any }) => {
      io.to(data.to).emit('call-made', {
        offer: data.offer,
        from: data.from,
        callerInfo: data.callerInfo,
      });
    });

    socket.on('make-answer', (data: { to: string; answer: any; from: string }) => {
      io.to(data.to).emit('answer-made', { answer: data.answer, from: data.from });
    });

    socket.on('ice-candidate', (data: { to: string; candidate: any; from: string }) => {
      io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: data.from });
    });

    socket.on('call-rejected', (data: { to: string; from: string }) => {
      io.to(data.to).emit('call-rejected', { from: data.from });
    });

    socket.on('call-ended', (data: { to: string; from: string }) => {
      io.to(data.to).emit('call-ended', { from: data.from });
    });

    socket.on('disconnect', () => {
      console.log('🔴 Client disconnected:', socket.id);
    });
  });
};
