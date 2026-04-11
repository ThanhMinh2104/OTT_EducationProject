import { Server, Socket } from 'socket.io';
import Message from '../models/Messages';
import ChatMember from '../models/ChatMember';

// Helper: tạo messageID tự động
const generateMessageID = async (): Promise<string> => {
  const last = await Message.findOne().sort({ messageID: -1 }).limit(1);
  if (!last) return 'msg001';
  const n = parseInt(last.messageID.replace('msg', ''), 10);
  return `msg${(n + 1).toString().padStart(3, '0')}`;
};

export const registerMessageEvents = (io: Server, socket: Socket) => {
  // ==================== 1. GỬI TIN NHẮN ====================
  socket.on('send_message', async (data: any) => {
    try {
      const messageID = await generateMessageID();

      const newMsg = new Message({
        messageID,
        chatID: data.chatID,
        senderID: data.senderID,
        content: data.content || '',
        type: data.type || 'text',
        timestamp: data.timestamp || new Date(),
        media_url: data.media_url || [],
        status: 'sent',
        pinnedInfo: null,
        replyTo: data.replyTo || null,
      });

      const saved = await newMsg.save();

      // Lấy danh sách thành viên trong chat
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      const fullMessage = {
        ...data,
        messageID: saved.messageID,
        _id: saved._id,
        timestamp: saved.timestamp,
        status: 'sent',
        senderInfo: {
          name: data.senderInfo?.name || 'Người dùng',
          avatar: data.senderInfo?.avatar || null,
        },
      };

      // Gửi tới tất cả thành viên
      memberIDs.forEach((id) => io.to(id).emit('new_message', fullMessage));
      io.to(data.chatID).emit(data.chatID, fullMessage);

      // Cập nhật trạng thái delivered sau 1 giây
      setTimeout(async () => {
        await Message.findOneAndUpdate({ messageID: saved.messageID }, { status: 'delivered' });
        io.to(data.chatID).emit(`status_update_${data.chatID}`, {
          messageID: saved.messageID,
          status: 'delivered',
        });
      }, 1000);
    } catch (e) {
      console.error('send_message error:', e);
    }
  });

  // ==================== 2. ĐÁNH DẤU ĐÃ ĐỌC ====================
  socket.on('read_messages', async ({ chatID, userID }: { chatID: string; userID: string }) => {
    try {
      await Message.updateMany({ chatID, status: { $ne: 'read' } }, { status: 'read' });

      io.to(chatID).emit(`status_update_${chatID}`, { userID, status: 'read' });
      io.to(userID).emit('status_update_all', { chatID, userID, status: 'read' });
    } catch (e) {
      console.error('read_messages error:', e);
    }
  });

  // ==================== 3. THU HỒI TIN NHẮN ====================
  socket.on('unsend_message', async ({ messageID, chatID, senderID }: any) => {
    try {
      const msg = await Message.findOne({ messageID });
      if (!msg || msg.senderID !== senderID) return;

      // Đổi type thành unsend và xóa nội dung
      msg.type = 'unsend';
      msg.content = '';
      msg.media_url = [];
      await msg.save();

      // Lấy danh sách thành viên
      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      // Thông báo cho tất cả thành viên
      memberIDs.forEach((id) => io.to(id).emit('unsend_notification', msg));
      io.to(chatID).emit('unsend_notification', msg);
    } catch (e) {
      console.error('unsend_message error:', e);
    }
  });

  // ==================== 4. GHIM TIN NHẮN ====================
  socket.on('ghim_message', async ({ messageID, chatID, senderID }: any) => {
    try {
      const msg = await Message.findOneAndUpdate(
        { messageID },
        { pinnedInfo: { pinnedBy: senderID, pinnedAt: new Date() } },
        { new: true }
      );
      if (!msg) return;

      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
      
      memberIDs.forEach((id) => io.to(id).emit('ghim_notification', msg));
      io.to(chatID).emit('ghim_notification', msg);
    } catch (e) {
      console.error('ghim_message error:', e);
    }
  });

  // ==================== 5. BỎ GHIM TIN NHẮN ====================
  socket.on('unghim_message', async ({ messageID, chatID }: any) => {
    try {
      const msg = await Message.findOneAndUpdate(
        { messageID },
        { $unset: { pinnedInfo: '' } },
        { new: true }
      );
      if (!msg) return;

      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
      
      memberIDs.forEach((id) => io.to(id).emit('unghim_notification', msg));
      io.to(chatID).emit('unghim_notification', msg);
    } catch (e) {
      console.error('unghim_message error:', e);
    }
  });

  // ==================== 6.  XÓA TIN NHẮN PHÍA CLIENT (MỚI) ====================
  socket.on('delete_message_local', async (data: { 
    messageID: string; 
    userID: string; 
    chatID: string 
  }) => {
    try {
      // Thêm userID vào mảng deletedFor
      const msg = await Message.findOneAndUpdate(
        { messageID: data.messageID },
        { $addToSet: { deletedFor: data.userID } }, // $addToSet: không thêm nếu đã tồn tại
        { new: true }
      );

      if (!msg) {
        console.error('Message not found:', data.messageID);
        return;
      }

      // Chỉ gửi thông báo cho user đó (không gửi cho người khác)
      io.to(data.userID).emit('message_deleted_local', {
        messageID: data.messageID,
        chatID: data.chatID,
        userID: data.userID,
      });

      console.log(`✅ User ${data.userID} deleted message ${data.messageID} locally`);
    } catch (e) {
      console.error('delete_message_local error:', e);
    }
  });

  // ==================== 7.  CHUYỂN TIẾP TIN NHẮN (MỚI) ====================
  socket.on('forward_message', async (data: {
    originalMessageID: string;
    targetChatID: string;
    senderID: string;
    senderInfo: {
      name: string;
      avatar: string;
    };
  }) => {
    try {
      // Lấy tin nhắn gốc
      const originalMsg = await Message.findOne({ messageID: data.originalMessageID });
      if (!originalMsg) {
        console.error('Original message not found:', data.originalMessageID);
        return;
      }

      // Không cho phép forward tin nhắn đã thu hồi
      if (originalMsg.type === 'unsend') {
        console.error('Cannot forward unsent message');
        return;
      }

      // Tạo messageID mới
      const messageID = await generateMessageID();

      // Tạo tin nhắn mới (copy từ tin nhắn gốc)
      const newMsg = new Message({
        messageID,
        chatID: data.targetChatID,
        senderID: data.senderID,
        content: originalMsg.content,
        type: originalMsg.type,
        timestamp: new Date(),
        media_url: originalMsg.media_url,
        status: 'sent',
        forwardedFrom: data.originalMessageID, // ⭐ Đánh dấu là tin nhắn forward
        replyTo: null, // Không giữ replyTo khi forward
        pinnedInfo: null, // Không giữ pinnedInfo khi forward
      });

      const saved = await newMsg.save();

      // Lấy danh sách thành viên của chat đích
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.targetChatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      const fullMessage = {
        messageID: saved.messageID,
        _id: saved._id,
        chatID: data.targetChatID,
        senderID: data.senderID,
        content: saved.content,
        type: saved.type,
        timestamp: saved.timestamp,
        media_url: saved.media_url,
        status: 'sent',
        forwardedFrom: data.originalMessageID,
        senderInfo: data.senderInfo,
      };

      // Gửi tới tất cả thành viên của chat đích
      memberIDs.forEach((id) => io.to(id).emit('new_message', fullMessage));
      io.to(data.targetChatID).emit(data.targetChatID, fullMessage);

      console.log(`✅ Message ${data.originalMessageID} forwarded to chat ${data.targetChatID} as ${messageID}`);

      // Cập nhật trạng thái delivered sau 1 giây
      setTimeout(async () => {
        await Message.findOneAndUpdate({ messageID: saved.messageID }, { status: 'delivered' });
        io.to(data.targetChatID).emit(`status_update_${data.targetChatID}`, {
          messageID: saved.messageID,
          status: 'delivered',
        });
      }, 1000);
    } catch (e) {
      console.error('forward_message error:', e);
    }
  });
};
