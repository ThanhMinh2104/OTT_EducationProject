import { Server, Socket } from 'socket.io';
import GroupMessage from '../models/GroupMessage';
import GroupMember from '../models/GroupMember';
import MessageReaction from '../models/MessageReaction';
import Users from '../models/User';
import { v4 as uuidv4 } from 'uuid';

const generateMessageID = async (): Promise<string> => {
  const last = await GroupMessage.findOne().sort({ messageID: -1 }).limit(1);
  if (!last) return 'gmsg001';
  const n = parseInt(last.messageID.replace('gmsg', ''), 10);
  return `gmsg${(n + 1).toString().padStart(3, '0')}`;
};

export const registerGroupChatEvents = (io: Server, socket: Socket) => {
  // ==================== JOIN/LEAVE GROUP ====================

  socket.on('join_group', async (data: { groupID: string; userID: string }) => {
    try {
      const { groupID, userID } = data;

      // Kiểm tra user có trong group không
      const member = await GroupMember.findOne({
        groupID,
        userID,
        isActive: true,
      });

      if (!member) {
        socket.emit('error_notification', {
          message: 'Bạn không có quyền truy cập nhóm này',
        });
        return;
      }

      socket.join(groupID);
      socket.join(`user_${userID}`);

      // Thông báo user khác
      socket.to(groupID).emit('member_online', {
        groupID,
        userID,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error joining group:', error);
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
      const messageID = await generateMessageID();
      const { groupID, senderID, content, type, media_url, replyTo, groupId } = data;

      // Kiểm tra quyền
      const member = await GroupMember.findOne({
        groupID,
        userID: senderID,
        isActive: true,
      });

      if (!member) {
        socket.emit('error_notification', {
          message: 'Bạn không có quyền gửi tin nhắn trong nhóm này',
        });
        return;
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
      console.error('Error sending group message:', error);
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
};
