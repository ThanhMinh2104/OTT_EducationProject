import { Server, Socket } from 'socket.io';
import GroupMessage from '../models/GroupMessage';
import GroupMember from '../models/GroupMember';
import MessageReaction from '../models/MessageReaction';
import Users from '../models/User';
import Group from '../models/Group';
import { v4 as uuidv4 } from 'uuid';

// Generate unique messageID using UUID
const generateMessageID = (): string => {
  return `gmsg_${uuidv4()}`;
};

export const registerGroupChatEvents = (io: Server, socket: Socket) => {
  // ==================== JOIN/LEAVE GROUP ====================

  socket.on('join_group', async (data: { groupID: string; userID: string }) => {
    try {
      const { groupID, userID } = data;

      console.log('🚪 join_group request:', { groupID, userID, socketID: socket.id });

      // Kiểm tra user có trong group không
      const member = await GroupMember.findOne({
        groupID,
        userID,
        isActive: true,
      });

      if (!member) {
        console.error('❌ Member not found for join_group:', { groupID, userID });
        socket.emit('error_notification', {
          message: 'Bạn không có quyền truy cập nhóm này',
        });
        return;
      }

      socket.join(groupID);
      socket.join(`user_${userID}`);

      console.log('✅ Socket joined group:', { 
        groupID, 
        userID, 
        socketID: socket.id,
        rooms: Array.from(socket.rooms)
      });

      // Thông báo user khác
      socket.to(groupID).emit('member_online', {
        groupID,
        userID,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('❌ Error joining group:', error);
    }
  });

  socket.on('leave_group', (data: { groupID: string; userID: string }) => {
    const { groupID, userID } = data;
    socket.leave(groupID);
    socket.leave(`user_${userID}`);

    socket.to(groupID).emit('member_offline', {
      groupID,
      userID,
      timestamp: new Date(),
    });
  });

  // ==================== SEND MESSAGE ====================

  socket.on('send_group_message', async (data: any) => {
    try {
      console.log('📨 Backend received send_group_message:', {
        groupID: data.groupID,
        senderID: data.senderID,
        content: data.content?.substring(0, 50),
        type: data.type,
      });

      const messageID = generateMessageID();
      const { groupID, senderID, content, type, media_url, replyTo, groupId } = data;

      // Kiểm tra quyền
      const member = await GroupMember.findOne({
        groupID,
        userID: senderID,
        isActive: true,
      });

      console.log('👤 Member check:', {
        found: !!member,
        role: member?.role,
        isActive: member?.isActive,
      });

      if (!member) {
        console.error('❌ Member not found or not active');
        socket.emit('error_notification', {
          message: 'Bạn không có quyền gửi tin nhắn trong nhóm này',
        });
        return;
      }

      // Kiểm tra quyền gửi tin nhắn
      const group = await Group.findOne({ groupID });
      if (group?.settings?.memberPermissions?.sendMessages === false) {
        // Nếu tắt quyền gửi tin nhắn, chỉ owner và admin mới được gửi
        if (member.role !== 'owner' && member.role !== 'admin') {
          console.error('❌ Member does not have permission to send messages');
          socket.emit('error_notification', {
            message: 'Chỉ trưởng nhóm và phó nhóm mới có thể gửi tin nhắn',
          });
          return;
        }
      }

      const newMsg = new GroupMessage({
        messageID,
        groupID,
        senderID,
        content,
        type: type || 'text',
        media_url: media_url || [],
        timestamp: new Date(),
        replyTo,
        groupId, // Thêm groupId để gom nhóm ảnh
      });

      const saved = await newMsg.save();

      // Lấy thông tin người gửi
      const sender = await Users.findOne({ userID: senderID });

      const fullMessage = {
        messageID: saved.messageID,
        groupID,
        senderID,
        content,
        type: type || 'text',
        media_url: media_url || [],
        timestamp: saved.timestamp,
        status: 'sent',
        replyTo,
        groupId, // Thêm groupId vào response
        senderInfo: {
          name: sender?.name || 'Người dùng',
          avatar: sender?.anhDaiDien || null,
        },
      };

      // Gửi tới tất cả trong group
      console.log('✅ Broadcasting message to group:', groupID);
      io.to(groupID).emit('new_group_message', fullMessage);

      // Update status sau 1s
      setTimeout(async () => {
        await GroupMessage.findOneAndUpdate(
          { messageID },
          { status: 'delivered' }
        );
        io.to(groupID).emit('message_status_update', {
          messageID,
          status: 'delivered',
        });
      }, 1000);
    } catch (error: any) {
      console.error('❌ Error sending group message:', error);
      socket.emit('error_notification', {
        message: 'Lỗi gửi tin nhắn',
      });
    }
  });

  // ==================== MESSAGE REACTIONS ====================

  socket.on('add_reaction', async (data: any) => {
    try {
      const { messageID, userID, emoji, groupID } = data;

      // Kiểm tra message tồn tại
      const message = await GroupMessage.findOne({ messageID, groupID });
      if (!message) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Xóa reaction cũ nếu có
      await MessageReaction.deleteOne({ messageID, userID });

      // Thêm reaction mới
      const reaction = new MessageReaction({
        messageID,
        userID,
        emoji,
      });
      await reaction.save();

      // Lấy tất cả reactions
      const reactions = await MessageReaction.find({ messageID });

      io.to(groupID).emit('reaction_updated', {
        messageID,
        reactions: reactions.map((r) => ({
          userID: r.userID,
          emoji: r.emoji,
        })),
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  });

  socket.on('remove_reaction', async (data: any) => {
    try {
      const { messageID, userID, groupID } = data;

      await MessageReaction.deleteOne({ messageID, userID });

      const reactions = await MessageReaction.find({ messageID });

      io.to(groupID).emit('reaction_updated', {
        messageID,
        reactions: reactions.map((r) => ({
          userID: r.userID,
          emoji: r.emoji,
        })),
      });
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  });

  // ==================== MESSAGE ACTIONS ====================

  socket.on('delete_group_message', async (data: any) => {
    try {
      const { messageID, userID, groupID, deleteForAll } = data;

      const message = await GroupMessage.findOne({ messageID, groupID });
      if (!message) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Chỉ người gửi hoặc admin/owner mới được xóa
      const member = await GroupMember.findOne({ groupID, userID });
      if (message.senderID !== userID && !['owner', 'admin'].includes(member?.role || '')) {
        socket.emit('error_notification', {
          message: 'Bạn không có quyền xóa tin nhắn này',
        });
        return;
      }

      if (deleteForAll) {
        // Xóa cho tất cả
        await GroupMessage.findOneAndUpdate(
          { messageID },
          {
            type: 'notification',
            content: 'Tin nhắn đã bị xóa',
            media_url: [],
          }
        );
      } else {
        // Xóa chỉ cho user này
        await GroupMessage.findOneAndUpdate(
          { messageID },
          { $addToSet: { deletedFor: userID } }
        );
      }

      io.to(groupID).emit('message_deleted', {
        messageID,
        deleteForAll,
        deletedBy: userID,
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });

  socket.on('mark_as_read', async (data: any) => {
    try {
      const { messageID, userID, groupID } = data;

      const message = await GroupMessage.findOne({ messageID, groupID });
      if (!message) return;

      // Kiểm tra user đã read chưa
      const alreadyRead = message.seenBy?.some((s) => s.userID === userID);
      if (!alreadyRead) {
        await GroupMessage.findOneAndUpdate(
          { messageID },
          {
            $push: {
              seenBy: {
                userID,
                readAt: new Date(),
              },
            },
            status: 'read',
          }
        );
      }

      io.to(groupID).emit('message_read', {
        messageID,
        userID,
        readAt: new Date(),
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  });

  // ==================== TYPING INDICATOR ====================

  const typingTimers: Map<string, NodeJS.Timeout> = new Map();

  socket.on('group_typing_start', (data: any) => {
    const { groupID, userID, userName } = data;
    const key = `${groupID}:${userID}`;

    // Clear existing timer
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key)!);
    }

    socket.to(groupID).emit('group_typing_start', {
      groupID,
      userID,
      userName,
    });

    // Auto stop sau 3s
    const timer = setTimeout(() => {
      socket.to(groupID).emit('group_typing_stop', { groupID, userID });
      typingTimers.delete(key);
    }, 3000);

    typingTimers.set(key, timer);
  });

  socket.on('group_typing_stop', (data: any) => {
    const { groupID, userID } = data;
    const key = `${groupID}:${userID}`;

    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key)!);
      typingTimers.delete(key);
    }

    socket.to(groupID).emit('group_typing_stop', { groupID, userID });
  });

  // ==================== MENTION ====================

  socket.on('mention_user', async (data: any) => {
    try {
      const { groupID, mentionedUserID, messageID, mentionerID } = data;

      const mentioner = await Users.findOne({ userID: mentionerID });

      io.to(`user_${mentionedUserID}`).emit('user_mentioned', {
        groupID,
        messageID,
        mentionerName: mentioner?.name,
        mentionerID,
      });
    } catch (error) {
      console.error('Error mentioning user:', error);
    }
  });

  // ==================== PIN MESSAGE ====================

  socket.on('ghim_group_message', async (data: any) => {
    try {
      const { messageID, groupID, senderID } = data;

      console.log('📌 Pin group message:', { messageID, groupID, senderID });

      // Kiểm tra quyền ghim
      const member = await GroupMember.findOne({ groupID, userID: senderID });
      if (!member) {
        socket.emit('error_notification', { message: 'Bạn không có quyền ghim tin nhắn' });
        return;
      }

      // Kiểm tra permission nếu là member thường
      if (member.role === 'member') {
        const group = await Group.findOne({ groupID });
        if (!group?.settings?.memberPermissions?.pinMessages) {
          socket.emit('error_notification', { message: 'Bạn không có quyền ghim tin nhắn' });
          return;
        }
      }

      // Update message với pinnedInfo
      const msg = await GroupMessage.findOneAndUpdate(
        { messageID, groupID },
        { pinnedInfo: { pinnedBy: senderID, pinnedAt: new Date() } },
        { new: true }
      );

      if (!msg) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Lấy thông tin người ghim
      const user = await Users.findOne({ userID: senderID });
      const userName = user?.name || 'Người dùng';

      // Tạo notification message
      const notifMessageID = generateMessageID();
      let displayContent = '';
      
      if (msg.content) {
        displayContent = msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content;
      } else {
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
      
      const notificationMsg = new GroupMessage({
        messageID: notifMessageID,
        groupID,
        senderID,
        content: `${userName} đã ghim ${displayContent}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      
      await notificationMsg.save();

      console.log('✅ Message pinned successfully');

      // Emit to all members in group
      io.to(groupID).emit('ghim_group_notification', msg);
      io.to(groupID).emit('new_group_message', {
        ...notificationMsg.toObject(),
        senderInfo: { name: userName, avatar: user?.anhDaiDien || null },
      });
    } catch (error) {
      console.error('❌ Error pinning group message:', error);
      socket.emit('error_notification', { message: 'Lỗi khi ghim tin nhắn' });
    }
  });

  socket.on('unghim_group_message', async (data: any) => {
    try {
      const { messageID, groupID, senderID } = data;

      console.log('📌 Unpin group message:', { messageID, groupID, senderID });

      // Kiểm tra quyền bỏ ghim
      const member = await GroupMember.findOne({ groupID, userID: senderID });
      if (!member) {
        socket.emit('error_notification', { message: 'Bạn không có quyền bỏ ghim tin nhắn' });
        return;
      }

      // Kiểm tra permission nếu là member thường
      if (member.role === 'member') {
        const group = await Group.findOne({ groupID });
        if (!group?.settings?.memberPermissions?.pinMessages) {
          socket.emit('error_notification', { message: 'Bạn không có quyền bỏ ghim tin nhắn' });
          return;
        }
      }

      // Remove pinnedInfo from message
      const msg = await GroupMessage.findOneAndUpdate(
        { messageID, groupID },
        { $unset: { pinnedInfo: '' } },
        { new: true }
      );

      if (!msg) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Lấy thông tin người bỏ ghim
      const user = await Users.findOne({ userID: senderID });
      const userName = user?.name || 'Người dùng';

      // Tạo notification message
      const notifMessageID = generateMessageID();
      let displayContent = '';
      
      if (msg.content) {
        displayContent = msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content;
      } else {
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
      
      const notificationMsg = new GroupMessage({
        messageID: notifMessageID,
        groupID,
        senderID,
        content: `${userName} đã bỏ ghim ${displayContent}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      
      await notificationMsg.save();

      console.log('✅ Message unpinned successfully');

      // Emit to all members in group
      io.to(groupID).emit('unghim_group_notification', msg);
      io.to(groupID).emit('new_group_message', {
        ...notificationMsg.toObject(),
        senderInfo: { name: userName, avatar: user?.anhDaiDien || null },
      });
    } catch (error) {
      console.error('❌ Error unpinning group message:', error);
      socket.emit('error_notification', { message: 'Lỗi khi bỏ ghim tin nhắn' });
    }
  });

  // ==================== UNSEND MESSAGE ====================

  socket.on('unsend_group_message', async (data: any) => {
    try {
      const { messageID, groupID, senderID } = data;

      console.log('🔄 Unsend group message:', { messageID, groupID, senderID });

      const message = await GroupMessage.findOne({ messageID, groupID });
      if (!message) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Chỉ người gửi mới được thu hồi
      if (message.senderID !== senderID) {
        socket.emit('error_notification', { message: 'Bạn chỉ có thể thu hồi tin nhắn của mình' });
        return;
      }

      // Update message thành unsend
      await GroupMessage.findOneAndUpdate(
        { messageID },
        {
          type: 'notification',
          content: 'Tin nhắn đã bị thu hồi',
          media_url: [],
        }
      );

      // Nếu là image group, thu hồi tất cả ảnh trong group
      if (message.groupId) {
        await GroupMessage.updateMany(
          { groupId: message.groupId, senderID },
          {
            type: 'notification',
            content: 'Tin nhắn đã bị thu hồi',
            media_url: [],
          }
        );
      }

      // Emit to all members in group
      io.to(groupID).emit('unsend_group_notification', {
        messageID,
        groupID,
        senderID,
      });

      console.log('✅ Message unsent successfully');
    } catch (error) {
      console.error('❌ Error unsending group message:', error);
      socket.emit('error_notification', { message: 'Lỗi khi thu hồi tin nhắn' });
    }
  });

  // ==================== DELETE MESSAGE LOCAL ====================

  socket.on('delete_group_message_local', async (data: any) => {
    try {
      const { messageID, userID, groupID } = data;

      console.log('🗑️ Delete group message local:', { messageID, userID, groupID });

      const message = await GroupMessage.findOne({ messageID, groupID });
      if (!message) {
        socket.emit('error_notification', { message: 'Tin nhắn không tồn tại' });
        return;
      }

      // Thêm userID vào deletedFor array
      await GroupMessage.findOneAndUpdate(
        { messageID },
        { $addToSet: { deletedFor: userID } }
      );

      // Emit chỉ cho user này
      socket.emit('message_deleted_local', {
        messageID,
        userID,
        groupID,
      });

      console.log('✅ Message deleted locally for user:', userID);
    } catch (error) {
      console.error('❌ Error deleting group message locally:', error);
      socket.emit('error_notification', { message: 'Lỗi khi xóa tin nhắn' });
    }
  });

  // ==================== FORWARD MESSAGE ====================

  socket.on('forward_group_message', async (data: any) => {
    try {
      const { originalMessageID, originalChatID, originalGroupID, targetGroupID, senderID, senderInfo } = data;

      console.log('📤 Forward message to group:', { originalMessageID, targetGroupID, senderID });

      // Lấy tin nhắn gốc
      let originalMessage: any;
      if (originalGroupID) {
        originalMessage = await GroupMessage.findOne({ messageID: originalMessageID, groupID: originalGroupID });
      } else if (originalChatID) {
        // Import Messages model nếu cần
        const Messages = (await import('../models/Messages')).default;
        originalMessage = await Messages.findOne({ messageID: originalMessageID, chatID: originalChatID });
      }

      if (!originalMessage) {
        socket.emit('error_notification', { message: 'Tin nhắn gốc không tồn tại' });
        return;
      }

      // Kiểm tra quyền gửi tin nhắn trong group
      const member = await GroupMember.findOne({
        groupID: targetGroupID,
        userID: senderID,
        isActive: true,
      });

      if (!member) {
        socket.emit('error_notification', { message: 'Bạn không có quyền gửi tin nhắn trong nhóm này' });
        return;
      }

      // Tạo tin nhắn mới
      const newMessageID = generateMessageID();
      const forwardedMessage = new GroupMessage({
        messageID: newMessageID,
        groupID: targetGroupID,
        senderID,
        content: originalMessage.content,
        type: originalMessage.type,
        media_url: originalMessage.media_url || [],
        timestamp: new Date(),
        forwardedFrom: originalMessageID,
      });

      await forwardedMessage.save();

      // Emit to all members in target group
      io.to(targetGroupID).emit('new_group_message', {
        messageID: newMessageID,
        groupID: targetGroupID,
        senderID,
        content: originalMessage.content,
        type: originalMessage.type,
        media_url: originalMessage.media_url || [],
        timestamp: forwardedMessage.timestamp,
        status: 'sent',
        forwardedFrom: originalMessageID,
        senderInfo,
      });

      console.log('✅ Message forwarded to group successfully');
    } catch (error) {
      console.error('❌ Error forwarding message to group:', error);
      socket.emit('error_notification', { message: 'Lỗi khi chuyển tiếp tin nhắn' });
    }
  });
};
