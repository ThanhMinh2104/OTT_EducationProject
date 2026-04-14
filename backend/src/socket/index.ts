import { Server, Socket } from 'socket.io';
import Message from '../models/Messages';
import User from '../models/User';
import ChatMember from '../models/ChatMember';
import { v4 as uuidv4 } from 'uuid';

export const registerCallEvents = (io: Server, socket: Socket) => {
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
    io.to(data.to).emit('answer-made', { answer: data.answer, from: data.from });
  });

  socket.on('ice-candidate', (data: { to: string; candidate: any; from: string }) => {
    console.log(`🧊 ICE candidate from ${data.from} to ${data.to}`);
    io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: data.from });
  });

  socket.on('call-cancelled', async (data: { to: string; from: string; chatID?: string }) => {
    console.log(`🚫 Call cancelled by ${data.from}`);
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
