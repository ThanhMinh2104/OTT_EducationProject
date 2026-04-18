import { Server, Socket } from 'socket.io';
import Message from '../models/Messages';
import ChatMember from '../models/ChatMember';
import Users from '../models/User';

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

      // Lấy danh sách thành viên trong chat
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      // KIỂM TRA CHẶN (Chỉ áp dụng cho chat 1-1)
      let blockedRecipientID: string | null = null;
      if (memberIDs.length === 2) {
        const recipientID = memberIDs.find(id => id !== data.senderID);
        if (recipientID) {
          const recipient = await Users.findOne({ userID: recipientID });
          if (recipient?.blockedUsers?.includes(data.senderID)) {
            blockedRecipientID = recipientID;
          }
        }
      }

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
        groupId: data.groupId || null, // ⭐ Thêm groupId
        deletedFor: blockedRecipientID ? [blockedRecipientID] : [], // ⭐ Ẩn với người chặn
      });

      const saved = await newMsg.save();

      // ✅ Khôi phục chat nếu đã bị xóa (undelete khi có tin nhắn mới)
      if (chatMemberDoc) {
        const updates = chatMemberDoc.members.map((m) => {
          if (m.deletedAt) {
            console.log(`🔄 Undeleting chat ${data.chatID} for user ${m.userID}`);
            return { ...m, deletedAt: undefined };
          }
          return m;
        });
        chatMemberDoc.members = updates;
        await chatMemberDoc.save();
      }

      const fullMessage = {
        ...data,
        messageID: saved.messageID,
        _id: saved._id,
        timestamp: saved.timestamp,
        status: 'sent',
        groupId: saved.groupId, // ⭐ Thêm groupId
        senderInfo: {
          name: data.senderInfo?.name || 'Người dùng',
          avatar: data.senderInfo?.avatar || null,
        },
      };

      if (blockedRecipientID) {
        // Chỉ gửi lại cho chính người gửi (để hiển thị trên UI của họ)
        io.to(data.senderID).emit('new_message', fullMessage);
        // Lưu ý: KHÔNG emit tới chatID room để người chặn không nhận được
      } else {
        // Gửi tới tất cả thành viên
        memberIDs.forEach((id) => io.to(id).emit('new_message', fullMessage));
        io.to(data.chatID).emit(data.chatID, fullMessage);
      }

      // Cập nhật trạng thái delivered sau 1 giây
      setTimeout(async () => {
        await Message.findOneAndUpdate({ messageID: saved.messageID }, { status: 'delivered' });
        if (!blockedRecipientID) {
          io.to(data.chatID).emit(`status_update_${data.chatID}`, {
            messageID: saved.messageID,
            status: 'delivered',
          });
        } else {
          // Báo cho người gửi là sent/delivered ảo
          io.to(data.senderID).emit(`status_update_${data.chatID}`, {
            messageID: saved.messageID,
            status: 'delivered',
          });
        }
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
      console.log('🔄 Unsend message request:', { messageID, chatID, senderID });

      const msg = await Message.findOne({ messageID });
      if (!msg || msg.senderID !== senderID) {
        console.log('❌ Unsend failed: message not found or not sender');
        return;
      }

      // ⭐ Nếu tin nhắn thuộc image group, thu hồi toàn bộ group
      let messagesToUnsend: any[] = [msg];
      if (msg.type === 'image' && msg.groupId) {
        console.log('📸 Unsending entire image group:', msg.groupId);
        messagesToUnsend = await Message.find({ 
          groupId: msg.groupId, 
          chatID,
          senderID 
        });
      }

      // Đổi type thành unsend và xóa nội dung cho tất cả messages
      for (const message of messagesToUnsend) {
        message.type = 'unsend';
        message.content = '';
        message.media_url = [];
        await message.save();
      }

      console.log(`✅ ${messagesToUnsend.length} message(s) unsent, notifying members...`);

      // Lấy danh sách thành viên
      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      console.log('📤 Emitting unsend_notification to:', memberIDs);

      // Thông báo cho tất cả thành viên về tất cả messages đã thu hồi
      messagesToUnsend.forEach((message) => {
        memberIDs.forEach((id) => {
          io.to(id).emit('unsend_notification', message);
        });
        io.to(chatID).emit('unsend_notification', message);
      });
      
      console.log(`  → Sent to chat room: ${chatID}`);
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

      // Lấy thông tin người ghim
      const user = await Users.findOne({ userID: senderID });
      const userName = user?.name || 'Người dùng';

      // Tạo tin nhắn notification với nội dung phù hợp
      const notifMessageID = await generateMessageID();
      let displayContent = '';
      
      if (msg.content) {
        displayContent = msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content;
      } else {
        // Hiển thị loại media thay vì "[Media]"
        const mediaTypes: Record<string, string> = {
          'image': 'hình ảnh',
          'video': 'video',
          'audio': 'tin nhắn thoại',
          'file': 'file',
          'sticker': 'sticker',
          'gif': 'GIF',
        };
        displayContent = mediaTypes[msg.type] || 'tin nhắn';
      }
      
      const notificationMsg = new Message({
        messageID: notifMessageID,
        chatID,
        senderID,
        content: `${userName} đã ghim ${displayContent}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      
      await notificationMsg.save();

      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      // Emit ghim_notification và notification message
      memberIDs.forEach((id) => {
        io.to(id).emit('ghim_notification', msg);
        io.to(id).emit('new_message', {
          ...notificationMsg.toObject(),
          senderInfo: { name: userName, avatar: user?.anhDaiDien || null },
        });
      });
      // Chỉ emit ghim_notification cho room, không emit notification message để tránh duplicate
      io.to(chatID).emit('ghim_notification', msg);
    } catch (e) {
      console.error('ghim_message error:', e);
    }
  });

  // ==================== 5. BỎ GHIM TIN NHẮN ====================
  socket.on('unghim_message', async ({ messageID, chatID, senderID }: any) => {
    try {
      const msg = await Message.findOneAndUpdate(
        { messageID },
        { $unset: { pinnedInfo: '' } },
        { new: true }
      );
      if (!msg) return;

      // Lấy thông tin người bỏ ghim
      const user = await Users.findOne({ userID: senderID });
      const userName = user?.name || 'Người dùng';

      // Tạo tin nhắn notification với nội dung phù hợp
      const notifMessageID = await generateMessageID();
      let displayContent = '';
      
      if (msg.content) {
        displayContent = msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content;
      } else {
        // Hiển thị loại media thay vì "[Media]"
        const mediaTypes: Record<string, string> = {
          'image': 'hình ảnh',
          'video': 'video',
          'audio': 'tin nhắn thoại',
          'file': 'file',
          'sticker': 'sticker',
          'gif': 'GIF',
        };
        displayContent = mediaTypes[msg.type] || 'tin nhắn';
      }
      
      const notificationMsg = new Message({
        messageID: notifMessageID,
        chatID,
        senderID,
        content: `${userName} đã bỏ ghim ${displayContent}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      
      await notificationMsg.save();

      const chatMemberDoc = await ChatMember.findOne({ chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      // Emit unghim_notification và notification message
      memberIDs.forEach((id) => {
        io.to(id).emit('unghim_notification', msg);
        io.to(id).emit('new_message', {
          ...notificationMsg.toObject(),
          senderInfo: { name: userName, avatar: user?.anhDaiDien || null },
        });
      });
      // Chỉ emit unghim_notification cho room, không emit notification message để tránh duplicate
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
      const msg = await Message.findOne({ messageID: data.messageID });
      
      if (!msg) {
        console.error('Message not found:', data.messageID);
        return;
      }

      // ⭐ Nếu tin nhắn thuộc image group, xóa toàn bộ group
      let messagesToDelete: any[] = [msg];
      if (msg.type === 'image' && msg.groupId) {
        console.log('📸 Deleting entire image group locally:', msg.groupId);
        messagesToDelete = await Message.find({ 
          groupId: msg.groupId, 
          chatID: data.chatID 
        });
      }

      // Thêm userID vào mảng deletedFor cho tất cả messages
      for (const message of messagesToDelete) {
        await Message.findOneAndUpdate(
          { messageID: message.messageID },
          { $addToSet: { deletedFor: data.userID } },
          { new: true }
        );
      }

      // Chỉ gửi thông báo cho user đó (không gửi cho người khác)
      messagesToDelete.forEach((message) => {
        io.to(data.userID).emit('message_deleted_local', {
          messageID: message.messageID,
          chatID: data.chatID,
          userID: data.userID,
        });
      });

      console.log(`✅ User ${data.userID} deleted ${messagesToDelete.length} message(s) locally`);
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
  }, callback?: (response: any) => void) => {
    try {
      console.log('📨 Forward message request received:', {
        originalMessageID: data.originalMessageID,
        targetChatID: data.targetChatID,
        senderID: data.senderID,
      });

      // Lấy tin nhắn gốc
      const originalMsg = await Message.findOne({ messageID: data.originalMessageID });
      if (!originalMsg) {
        console.error('❌ Original message not found:', data.originalMessageID);
        if (callback) callback({ success: false, error: 'Message not found' });
        return;
      }

      // Không cho phép forward tin nhắn đã thu hồi
      if (originalMsg.type === 'unsend') {
        console.error('❌ Cannot forward unsent message');
        if (callback) callback({ success: false, error: 'Cannot forward unsent message' });
        return;
      }

      // ⭐ Nếu tin nhắn thuộc image group, chuyển tiếp toàn bộ group
      let messagesToForward: any[] = [originalMsg];
      if (originalMsg.type === 'image' && originalMsg.groupId) {
        console.log('📸 Forwarding entire image group:', originalMsg.groupId);
        messagesToForward = await Message.find({ 
          groupId: originalMsg.groupId, 
          chatID: originalMsg.chatID 
        });
      }

      // Lấy danh sách thành viên của chat đích
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.targetChatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];

      console.log('👥 Target chat members:', memberIDs);

      // ⭐ Tạo groupId mới cho batch ảnh được forward
      const newGroupId = messagesToForward.length > 1 
        ? `group_${Date.now()}_${data.senderID}` 
        : undefined;

      const forwardedMessageIDs: string[] = [];

      // Tạo và gửi từng tin nhắn
      for (const originalMessage of messagesToForward) {
        const messageID = await generateMessageID();

        // Tạo tin nhắn mới (copy từ tin nhắn gốc)
        const newMsg = new Message({
          messageID,
          chatID: data.targetChatID,
          senderID: data.senderID,
          content: originalMessage.content,
          type: originalMessage.type,
          timestamp: new Date(),
          media_url: originalMessage.media_url,
          status: 'sent',
          forwardedFrom: originalMessage.messageID, // Đánh dấu là tin nhắn forward
          groupId: newGroupId, // ⭐ Giữ groupId cho batch ảnh
          replyTo: null, // Không giữ replyTo khi forward
          pinnedInfo: null, // Không giữ pinnedInfo khi forward
        });

        const saved = await newMsg.save();
        forwardedMessageIDs.push(saved.messageID);
        console.log('💾 New message saved:', messageID);

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
          forwardedFrom: originalMessage.messageID,
          groupId: saved.groupId,
          senderInfo: data.senderInfo,
        };

        // Gửi tới tất cả thành viên của chat đích
        memberIDs.forEach((id) => {
          io.to(id).emit('new_message', fullMessage);
        });

        // Delay nhỏ giữa các lần gửi
        if (messagesToForward.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ ${messagesToForward.length} message(s) forwarded to chat ${data.targetChatID}`);

      // Gửi callback xác nhận thành công
      if (callback) {
        callback({ 
          success: true, 
          messageIDs: forwardedMessageIDs,
          targetChatID: data.targetChatID 
        });
      }

      // Cập nhật trạng thái delivered sau 1 giây
      setTimeout(async () => {
        for (const msgID of forwardedMessageIDs) {
          await Message.findOneAndUpdate({ messageID: msgID }, { status: 'delivered' });
          io.to(data.targetChatID).emit(`status_update_${data.targetChatID}`, {
            messageID: msgID,
            status: 'delivered',
          });
        }
      }, 1000);
    } catch (e) {
      console.error('❌ forward_message error:', e);
      if (callback) callback({ success: false, error: String(e) });
    }
  });
};
