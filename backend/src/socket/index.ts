import { Server, Socket } from 'socket.io';
import Message from '../models/Messages';
import User from '../models/User';
import ChatMember from '../models/ChatMember';
import { v4 as uuidv4 } from 'uuid';

// Map để theo dõi users đang trong cuộc gọi
const activeCallsMap = new Map<string, { with: string; startTime: number; timeout?: NodeJS.Timeout }>();

// Map để theo dõi socket.id -> userID
const socketToUserMap = new Map<string, string>();

// Export hàm để debug
export const getActiveCallsMap = () => activeCallsMap;
export const clearActiveCallsMap = () => {
  // Clear tất cả timeouts
  activeCallsMap.forEach((callInfo) => {
    if (callInfo.timeout) {
      clearTimeout(callInfo.timeout);
    }
  });
  activeCallsMap.clear();
  console.log('🧹 Cleared all active calls');
};

// Hàm cleanup để xóa user khỏi active calls
const removeFromActiveCalls = (userID: string) => {
  const callInfo = activeCallsMap.get(userID);
  if (callInfo) {
    // Clear timeout nếu có
    if (callInfo.timeout) {
      clearTimeout(callInfo.timeout);
    }
    // Xóa cả 2 users
    activeCallsMap.delete(userID);
    activeCallsMap.delete(callInfo.with);
    console.log(`🧹 Removed ${userID} and ${callInfo.with} from active calls`);
  }
};

export const registerCallEvents = (io: Server, socket: Socket) => {
  // Lắng nghe join_user để track userID
  socket.on('join_user', (userID: string) => {
    socketToUserMap.set(socket.id, userID);
    // Khi user join lại, xóa họ khỏi active calls (trường hợp reload page)
    if (activeCallsMap.has(userID)) {
      console.log(`🔄 User ${userID} rejoined, clearing from active calls`);
      removeFromActiveCalls(userID);
    }
  });

  // Cleanup khi socket disconnect
  socket.on('disconnect', () => {
    const userID = socketToUserMap.get(socket.id);
    if (userID) {
      console.log(`🔌 Socket ${socket.id} (user: ${userID}) disconnected`);
      // Xóa khỏi active calls nếu đang trong cuộc gọi
      if (activeCallsMap.has(userID)) {
        console.log(`🧹 Cleaning up active call for disconnected user ${userID}`);
        removeFromActiveCalls(userID);
      }
      socketToUserMap.delete(socket.id);
    }
  });
  
  // WebRTC signaling
  socket.on(
    'call-user',
    (data: {
      to: string;
      offer: any;
      from: string;
      callerInfo: any;
      callType?: 'voice' | 'video';
    }) => {
      console.log(`📞 Call from ${data.from} to ${data.to}, type: ${data.callType || 'video'}`);
      console.log(`📊 Current active calls map:`, Array.from(activeCallsMap.entries()));
      
      // Đánh dấu cả 2 users đang trong cuộc gọi
      // Tạo timeout 30 giây để tự động cleanup nếu không có response
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Call timeout: auto-removing ${data.from} and ${data.to} from active calls`);
        removeFromActiveCalls(data.from);
      }, 5000); // 5 giây
      
      activeCallsMap.set(data.from, { with: data.to, startTime: Date.now(), timeout: timeoutId });
      activeCallsMap.set(data.to, { with: data.from, startTime: Date.now(), timeout: timeoutId });
      
      console.log(`✅ Call allowed, active calls: ${activeCallsMap.size / 2}`);
      console.log(`📊 Updated active calls map:`, Array.from(activeCallsMap.entries()));
      
      io.to(data.to).emit('call-made', {
        offer: data.offer,
        from: data.from,
        callerInfo: data.callerInfo,
        callType: data.callType || 'video',
      });
    }
  );

  socket.on('make-answer', (data: { to: string; answer: any; from: string }) => {
    console.log(`✅ Answer from ${data.from} to ${data.to}`);
    
    // Clear timeout vì cuộc gọi đã được trả lời
    const callInfo = activeCallsMap.get(data.from);
    if (callInfo?.timeout) {
      clearTimeout(callInfo.timeout);
      console.log(`⏰ Cleared timeout for answered call`);
    }
    
    io.to(data.to).emit('answer-made', { answer: data.answer, from: data.from });
  });

  socket.on('ice-candidate', (data: { to: string; candidate: any; from: string }) => {
    console.log(`🧊 ICE candidate from ${data.from} to ${data.to}`);
    io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: data.from });
  });

  socket.on('call-cancelled', async (data: { to: string; from: string; chatID?: string }) => {
    console.log(`🚫 Call cancelled by ${data.from}`);
    
    // Xóa khỏi active calls
    removeFromActiveCalls(data.from);
    console.log(`📊 Active calls after cancel: ${activeCallsMap.size / 2}`);
    
    io.to(data.to).emit('call-cancelled', { from: data.from });

    // Lưu tin nhắn hệ thống về cuộc gọi nhỡ (vì người gọi hủy = người nhận nhỡ)
    if (data.chatID) {
      try {
        // Lấy thông tin user
        const user = await User.findOne({ userID: data.from });

        const callMessage = new Message({
          messageID: uuidv4(),
          chatID: data.chatID,
          senderID: data.from,
          type: 'call-missed',
          content: '',
          timestamp: new Date(),
          status: 'sent',
          media_url: [],
          senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
          pinnedInfo: undefined, // Explicitly set to undefined to avoid empty object
        });
        await callMessage.save();

        // Lấy danh sách thành viên trong chat
        const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
        const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

        // Emit both events to update chat list and chat window
        const messageData = {
          messageID: callMessage.messageID,
          chatID: data.chatID,
          senderID: data.from,
          type: 'call-missed',
          content: '',
          timestamp: callMessage.timestamp.toISOString(),
          status: 'sent',
          media_url: [],
          senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
        };

        // Gửi tới tất cả thành viên
        memberIDs.forEach((id) => io.to(id).emit('new_message', messageData));
        io.to(data.chatID).emit('new_message', messageData);
        io.to(data.chatID).emit(data.chatID, messageData);
      } catch (error) {
        console.error('Error saving call-cancelled message:', error);
      }
    }
  });

  socket.on(
    'call-rejected',
    async (data: { to: string; from: string; chatID?: string; callerInfo?: any }) => {
      console.log(`❌ Call rejected by ${data.from}`);
      
      // Xóa khỏi active calls
      removeFromActiveCalls(data.from);
      console.log(`📊 Active calls after reject: ${activeCallsMap.size / 2}`);
      
      io.to(data.to).emit('call-rejected', { from: data.from, callerInfo: data.callerInfo });

      // Lưu tin nhắn hệ thống về cuộc gọi bị từ chối vào database
      if (data.chatID) {
        try {
          // Lấy thông tin user
          const user = await User.findOne({ userID: data.from });

          const callMessage = new Message({
            messageID: uuidv4(),
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-rejected',
            content: '',
            timestamp: new Date(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
            pinnedInfo: undefined, // Explicitly set to undefined to avoid empty object
          });
          await callMessage.save();

          // Lấy danh sách thành viên trong chat
          const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
          const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

          // Emit both events to update chat list and chat window
          const messageData = {
            messageID: callMessage.messageID,
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-rejected',
            content: '',
            timestamp: callMessage.timestamp.toISOString(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
          };

          // Gửi tới tất cả thành viên
          memberIDs.forEach((id) => io.to(id).emit('new_message', messageData));
          io.to(data.chatID).emit('new_message', messageData);
          io.to(data.chatID).emit(data.chatID, messageData);
        } catch (error) {
          console.error('Error saving call-rejected message:', error);
        }
      }
    }
  );

  socket.on(
    'call-missed',
    async (data: { to: string; from: string; chatID?: string; callerInfo?: any }) => {
      console.log(`📵 Call missed by ${data.from}`);
      
      // Xóa khỏi active calls
      removeFromActiveCalls(data.from);
      console.log(`📊 Active calls after missed: ${activeCallsMap.size / 2}`);
      
      io.to(data.to).emit('call-missed', { from: data.from, callerInfo: data.callerInfo });

      // Lưu tin nhắn hệ thống về cuộc gọi nhỡ vào database
      if (data.chatID) {
        try {
          // Lấy thông tin user
          const user = await User.findOne({ userID: data.from });

          const callMessage = new Message({
            messageID: uuidv4(),
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-missed',
            content: '',
            timestamp: new Date(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
            pinnedInfo: undefined, // Explicitly set to undefined to avoid empty object
          });
          await callMessage.save();

          // Lấy danh sách thành viên trong chat
          const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
          const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

          // Emit both events to update chat list and chat window
          const messageData = {
            messageID: callMessage.messageID,
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-missed',
            content: '',
            timestamp: callMessage.timestamp.toISOString(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
          };

          // Gửi tới tất cả thành viên
          memberIDs.forEach((id) => io.to(id).emit('new_message', messageData));
          io.to(data.chatID).emit('new_message', messageData);
          io.to(data.chatID).emit(data.chatID, messageData);
        } catch (error) {
          console.error('Error saving call-missed message:', error);
        }
      }
    }
  );

  socket.on(
    'call-ended',
    async (data: { to: string; from: string; duration?: number; chatID?: string }) => {
      console.log(`📴 Call ended by ${data.from}, duration: ${data.duration || 0}s`);
      
      // Xóa khỏi active calls
      removeFromActiveCalls(data.from);
      console.log(`📊 Active calls after end: ${activeCallsMap.size / 2}`);
      
      io.to(data.to).emit('call-ended', { from: data.from, duration: data.duration });

      // Lưu tin nhắn hệ thống về cuộc gọi vào database
      if (data.chatID && data.duration && data.duration > 0) {
        try {
          const mins = Math.floor(data.duration / 60);
          const secs = data.duration % 60;
          const durationText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

          // Lấy thông tin user
          const user = await User.findOne({ userID: data.from });

          const callMessage = new Message({
            messageID: uuidv4(),
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-ended',
            content: durationText,
            timestamp: new Date(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
            pinnedInfo: undefined, // Explicitly set to undefined to avoid empty object
          });
          await callMessage.save();

          // Lấy danh sách thành viên trong chat
          const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
          const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

          // Emit both events to update chat list and chat window
          const messageData = {
            messageID: callMessage.messageID,
            chatID: data.chatID,
            senderID: data.from,
            type: 'call-ended',
            content: durationText,
            timestamp: callMessage.timestamp.toISOString(),
            status: 'sent',
            media_url: [],
            senderInfo: user ? { name: user.name, avatar: user.anhDaiDien || null } : undefined,
          };

          // Gửi tới tất cả thành viên
          memberIDs.forEach((id) => io.to(id).emit('new_message', messageData));
          io.to(data.chatID).emit('new_message', messageData);
          io.to(data.chatID).emit(data.chatID, messageData);
        } catch (error) {
          console.error('Error saving call-ended message:', error);
        }
      }
    }
  );
};
