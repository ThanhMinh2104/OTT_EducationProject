import { Router, Response } from 'express';
import { Server } from 'socket.io';
import multer from 'multer';
import Chat from '../models/Chat';
import ChatMember from '../models/ChatMember';
import Message from '../models/Messages';
import Users from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../services/uploadService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Helper: tạo chatID tự động
const generateChatID = async (): Promise<string> => {
  const last = await Chat.findOne().sort({ chatID: -1 }).limit(1);
  if (!last) return 'chat001';
  const n = parseInt(last.chatID.replace('chat', ''), 10);
  return `chat${(n + 1).toString().padStart(3, '0')}`;
};

// Helper: lấy danh sách chat đầy đủ cho user
export const getChatsForUser = async (userID: string) => {
  const memberDocs = await ChatMember.find({ 'members.userID': userID }).lean();
  const chatIDs = memberDocs.map((m) => m.chatID);
  if (!chatIDs.length) return [];

  const chats = await Chat.find({ chatID: { $in: chatIDs } }).lean();
  const allMessages = await Message.find({ chatID: { $in: chatIDs } }).sort({ timestamp: 1 }).lean();

  const senderIDs = [...new Set(allMessages.map((m) => m.senderID))];
  const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

  const enriched = allMessages.map((msg) => {
    const s = senders.find((u) => u.userID === msg.senderID);
    return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
  });

  const msgByChat: Record<string, typeof enriched> = {};
  enriched.forEach((m) => {
    if (!msgByChat[m.chatID]) msgByChat[m.chatID] = [];
    msgByChat[m.chatID].push(m);
  });

  const membersByChat: Record<string, { userID: string; role: string }[]> = {};
  memberDocs.forEach((doc) => {
    membersByChat[doc.chatID] = doc.members.map((m) => ({ userID: m.userID, role: m.role }));
  });

  return chats.map((c) => ({
    ...c,
    lastMessage: msgByChat[c.chatID] || [],
    members: membersByChat[c.chatID] || [],
  }));
};

export default function chatRoutes(io: Server) {
  const router = Router();

  // Lấy danh sách chat của user
  router.post('/chats/userID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const chats = await getChatsForUser(req.userID!);
      res.json(chats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Tạo chat 1-1
  router.post('/createChat1-1', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userID2 } = req.body;
      const userID1 = req.userID!;

      const existing = await ChatMember.find({ 'members.userID': { $all: [userID1, userID2] } }).lean();
      if (existing.length) {
        const chatIDs = existing.map((m) => m.chatID);
        const found = await Chat.findOne({ chatID: { $in: chatIDs }, type: 'private' }).lean();
        if (found) {
          const memberDoc = await ChatMember.findOne({ chatID: found.chatID }).lean();
          return res.json({ ...found, members: memberDoc?.members || [], lastMessage: [] }) as any;
        }
      }

      const user1 = await Users.findOne({ userID: userID1 });
      const user2 = await Users.findOne({ userID: userID2 });
      if (!user1 || !user2) return res.status(404).json({ message: 'User không tồn tại' }) as any;

      const chatID = await generateChatID();
      const members = [
        { userID: userID1, role: 'admin' },
        { userID: userID2, role: 'member' },
      ];

      const newChat = await Chat.create({
        chatID,
        type: 'private',
        avatar: user2.anhDaiDien || '',
        name: `${user1.name.split(' ').pop()} & ${user2.name.split(' ').pop()}`,
        created_at: new Date(),
      });

      await ChatMember.create({ chatID, members });
      const result = { ...newChat.toObject(), members, lastMessage: [] };

      io.to(userID1).emit('newChat1-1', result);
      io.to(userID2).emit('newChat1-1', result);

      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy tin nhắn theo chatID
  router.post('/messages/id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.body;
      const msgs = await Message.find({ chatID }).sort({ timestamp: 1 }).lean();
      const senderIDs = [...new Set(msgs.map((m) => m.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      const enriched = msgs.map((msg) => {
        const s = senders.find((u) => u.userID === msg.senderID);
        return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
      });
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Upload file
  router.post('/upload', authMiddleware, upload.array('files'), async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) return res.status(400).json({ error: 'No files' }) as any;
      const urls = await Promise.all(files.map((f) => uploadToCloudinary(f)));
      res.json({ urls });
    } catch (e: any) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Lấy thông tin 1 chat (dùng cho notification tap)
  router.get('/chat/:chatID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.params;
      const userID = req.userID!;
      const chatDoc = await Chat.findOne({ chatID }).lean();
      if (!chatDoc) return res.status(404).json({ message: 'Chat not found' });
      const memberDoc = await ChatMember.findOne({ chatID }).lean();
      const members = memberDoc?.members || [];
      if (!members.find((m) => m.userID === userID)) return res.status(403).json({ message: 'Forbidden' });
      const messages = await Message.find({ chatID }).sort({ timestamp: 1 }).lean();
      const senderIDs = [...new Set(messages.map((m) => m.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      const enriched = messages.map((msg) => {
        const s = senders.find((u) => u.userID === msg.senderID);
        return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
      });
      res.json({ ...chatDoc, members, lastMessage: enriched });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Tìm kiếm tin nhắn
  router.get('/messages/search', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID, keyword } = req.query as { chatID: string; keyword: string };
      const userID = req.userID!;
      if (!chatID || !keyword?.trim()) return res.json([]);
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      const msgs = await Message.find({
        chatID,
        type: { $in: ['text', 'emoji'] },
        content: { $regex: keyword.trim(), $options: 'i' },
      }).sort({ timestamp: -1 }).limit(50).lean();
      const senderIDs = [...new Set(msgs.map((m) => m.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      const result = msgs.map((m) => {
        const s = senders.find((u) => u.userID === m.senderID);
        return { ...m, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy media/file của chat
  router.get('/chats/:chatID/media', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.params;
      const userID = req.userID!;
      const { type = 'all', page = '1', limit = '30' } = req.query as Record<string, string>;
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      const typeFilter = type === 'image' ? ['image'] : type === 'video' ? ['video'] : type === 'file' ? ['file'] : ['image', 'video', 'file'];
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const msgs = await Message.find({ chatID, type: { $in: typeFilter } }).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean();
      const total = await Message.countDocuments({ chatID, type: { $in: typeFilter } });
      res.json({ items: msgs, total, page: parseInt(page), hasMore: skip + msgs.length < total });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Xóa lịch sử trò chuyện (phía mình)
  router.delete('/chats/:chatID/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.params;
      const userID = req.userID!;
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      await ChatMember.updateOne(
        { chatID, 'members.userID': userID },
        { $set: { 'members.$.deletedAt': new Date() } }
      );
      res.json({ success: true, deletedAt: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return router;
}
