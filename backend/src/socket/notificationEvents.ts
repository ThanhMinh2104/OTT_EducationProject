import { Server, Socket } from 'socket.io';
import Message from '../models/Messages';
import ChatMember from '../models/ChatMember';

interface TypingData {
  chatID: string;
  userID: string;
  userName: string;
}

interface ReadReceiptData {
  chatID: string;
  userID: string;
  userName: string;
  avatar?: string;
  messageID: string;
  readAt: string;
}

// Map lưu debounce timers cho typing
const typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export const registerNotificationEvents = (io: Server, socket: Socket) => {
  // ── Typing indicators ──────────────────────────────────────────────────────

  socket.on('typing_start', async (data: TypingData) => {
    const key = `${data.chatID}:${data.userID}`;

    // Broadcast tới room chatID VÀ tới từng userID room (ChatList)
    socket.to(data.chatID).emit('typing_start', {
      chatID: data.chatID,
      userID: data.userID,
      userName: data.userName,
    });

    try {
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
      memberIDs.forEach((id) => {
        if (id !== data.userID) {
          io.to(id).emit('typing_start', {
            chatID: data.chatID,
            userID: data.userID,
            userName: data.userName,
          });
        }
      });
    } catch { /* ignore */ }

    // Auto-stop sau 5s
    if (typingTimers.has(key)) clearTimeout(typingTimers.get(key)!);
    const timer = setTimeout(async () => {
      socket.to(data.chatID).emit('typing_stop', { chatID: data.chatID, userID: data.userID });
      try {
        const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
        const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
        memberIDs.forEach((id) => {
          if (id !== data.userID) {
            io.to(id).emit('typing_stop', { chatID: data.chatID, userID: data.userID });
          }
        });
      } catch { /* ignore */ }
      typingTimers.delete(key);
    }, 5000);
    typingTimers.set(key, timer);
  });

  socket.on('typing_stop', async (data: TypingData) => {
    const key = `${data.chatID}:${data.userID}`;
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key)!);
      typingTimers.delete(key);
    }
    socket.to(data.chatID).emit('typing_stop', { chatID: data.chatID, userID: data.userID });
    try {
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
      memberIDs.forEach((id) => {
        if (id !== data.userID) {
          io.to(id).emit('typing_stop', { chatID: data.chatID, userID: data.userID });
        }
      });
    } catch { /* ignore */ }
  });

  // ── Read receipts chi tiết ─────────────────────────────────────────────────

  socket.on('message_seen', async (data: ReadReceiptData) => {
    try {
      await Message.findOneAndUpdate(
        { messageID: data.messageID },
        {
          $addToSet: {
            seenBy: {
              userID: data.userID,
              userName: data.userName,
              avatar: data.avatar || null,
              readAt: data.readAt,
            },
          },
          status: 'read',
        }
      );
      io.to(data.chatID).emit('message_seen', {
        chatID: data.chatID,
        messageID: data.messageID,
        userID: data.userID,
        userName: data.userName,
        avatar: data.avatar || null,
        readAt: data.readAt,
      });
    } catch (e) {
      console.error('message_seen error:', e);
    }
  });

  // ── Bulk seen khi mở chat ─────────────────────────────────────────────────

  socket.on('bulk_seen', async (data: { chatID: string; userID: string; userName: string; avatar?: string }) => {
    try {
      const readAt = new Date().toISOString();
      const unread = await Message.find({
        chatID: data.chatID,
        senderID: { $ne: data.userID },
        'seenBy.userID': { $ne: data.userID },
      }).select('messageID').lean();

      if (unread.length === 0) return;

      await Message.updateMany(
        { chatID: data.chatID, senderID: { $ne: data.userID }, 'seenBy.userID': { $ne: data.userID } },
        {
          $addToSet: {
            seenBy: { userID: data.userID, userName: data.userName, avatar: data.avatar || null, readAt },
          },
          status: 'read',
        }
      );

      io.to(data.chatID).emit('bulk_seen', {
        chatID: data.chatID,
        userID: data.userID,
        userName: data.userName,
        avatar: data.avatar || null,
        readAt,
        messageIDs: unread.map((m) => m.messageID),
      });
    } catch (e) {
      console.error('bulk_seen error:', e);
    }
  });

  // ── Reminder events ───────────────────────────────────────────────────────

  socket.on('reminder_event', async (data: {
    id: string;
    chatID: string;
    type: 'created' | 'deleted';
    reminder: { id: string; chatID: string; title: string; datetime: string; repeat: string; done: boolean };
    userName: string;
    userID: string;
    createdAt: string;
  }) => {
    try {
      socket.to(data.chatID).emit('reminder_event', data);
      const chatMemberDoc = await ChatMember.findOne({ chatID: data.chatID });
      const memberIDs = chatMemberDoc?.members.map((m) => m.userID) || [];
      memberIDs.forEach((id) => {
        if (id !== data.userID) io.to(id).emit('reminder_event', data);
      });
    } catch (e) {
      console.error('reminder_event error:', e);
    }
  });
};
