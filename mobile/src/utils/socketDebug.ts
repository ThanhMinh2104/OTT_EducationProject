import socket from './socket';

/**
 * Debug utility cho Socket.IO
 * Thêm các event listeners để theo dõi kết nối
 */

export const initSocketDebug = () => {
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    console.log('🔌 Transport:', socket.io.engine.transport.name);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 Socket reconnection attempt:', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Socket reconnection failed');
  });

  // Log tất cả events
  socket.onAny((eventName, ...args) => {
    console.log('📡 Socket event:', eventName, args);
  });

  console.log('🔧 Socket debug initialized');
};

export const testSocketConnection = () => {
  console.log('🧪 Testing socket connection...');
  console.log('Socket ID:', socket.id);
  console.log('Socket connected:', socket.connected);
  console.log('Socket disconnected:', socket.disconnected);
  
  if (!socket.connected) {
    console.log('⚠️ Socket not connected, attempting to connect...');
    socket.connect();
  }
};

export const testJoinGroup = (groupID: string, userID: string) => {
  console.log('🧪 Testing join_group:', { groupID, userID });
  socket.emit('join_group', { groupID, userID });
  
  // Listen for response
  socket.once('error_notification', (data) => {
    console.error('❌ Join group error:', data);
  });
};

export const testSendMessage = (groupID: string, userID: string, content: string) => {
  console.log('🧪 Testing send_group_message:', { groupID, userID, content });
  
  const message = {
    groupID,
    senderID: userID,
    content,
    type: 'text',
    media_url: [],
    senderInfo: {
      name: 'Test User',
      avatar: null,
    },
  };
  
  socket.emit('send_group_message', message);
  
  // Listen for response
  socket.once('new_group_message', (data) => {
    console.log('✅ Received new_group_message:', data);
  });
  
  socket.once('error_notification', (data) => {
    console.error('❌ Send message error:', data);
  });
};
