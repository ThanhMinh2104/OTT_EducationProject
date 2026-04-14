import { Router, Response } from 'express';
import { Server } from 'socket.io';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../services/uploadService';
import Chat from '../models/Chat';
import ChatMember from '../models/ChatMember';
import Message from '../models/Messages';
import Users from '../models/User';
import Contacts from '../models/Contacts';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Helper: tạo chatID tự động
const generateChatID = async (): Promise<string> => {
  const last = await Chat.findOne().sort({ chatID: -1 }).limit(1);
  if (!last) return 'chat001';
  const n = parseInt(last.chatID.replace('chat', ''), 10);
  return `chat${(n + 1).toString().padStart(3, '0')}`;
};

// Helper: lấy danh sách chat đầy đủ cho user
export const getChatsForUser = async (userID: string, includeStrangers: boolean = false) => {
  const memberDocs = await ChatMember.find({ 'members.userID': userID }).lean();
  const chatIDs = memberDocs.map((m) => m.chatID);
  if (!chatIDs.length) return [];

  const chats = await Chat.find({ chatID: { $in: chatIDs } }).lean();

  // Chỉ lấy 20 tin nhắn gần nhất mỗi chat thay vì toàn bộ
  const allMessages = await Message.aggregate([
    { $match: { chatID: { $in: chatIDs }, deletedFor: { $ne: userID } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: '$chatID', messages: { $push: '$$ROOT' } } },
    { $project: { messages: { $slice: ['$messages', -50] } } }, // 50 tin nhắn gần nhất
  ]);

  const flatMessages = allMessages.flatMap((g: any) => g.messages);
  const senderIDs = [...new Set(flatMessages.map((m: any) => m.senderID))];
  const senders = await Users.find({ userID: { $in: senderIDs } }).lean();

  const enriched = flatMessages.map((msg: any) => {
    const s = senders.find((u) => u.userID === msg.senderID);
    return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
  });

  const msgByChat: Record<string, typeof enriched> = {};
  enriched.forEach((m: any) => {
    if (!msgByChat[m.chatID]) msgByChat[m.chatID] = [];
    msgByChat[m.chatID].push(m);
  });

  const membersByChat: Record<string, { userID: string; role: string }[]> = {};
  memberDocs.forEach((doc) => {
    membersByChat[doc.chatID] = doc.members.map((m) => ({ userID: m.userID, role: m.role }));
  });

  // Batch load tất cả contacts của user 1 lần thay vì query từng cái
  const allContacts = await Contacts.find({
    $or: [{ userID }, { contactID: userID }],
    status: 'accepted',
  }).lean();
  const friendIDs = new Set(
    allContacts.map((c) => (c.userID === userID ? c.contactID : c.userID))
  );

  // Batch load private chats cần check stranger
  const privateChatIDs = chats
    .filter((c) => c.type === 'private')
    .map((c) => c.chatID);

  // Lấy tin nhắn đầu tiên của tất cả private chats 1 lần
  const firstMsgs = privateChatIDs.length > 0 ? await Message.aggregate([
    { $match: { chatID: { $in: privateChatIDs }, type: { $nin: ['notification'] } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: '$chatID', firstSenderID: { $first: '$senderID' } } },
  ]) : [];
  const firstMsgMap: Record<string, string> = {};
  firstMsgs.forEach((m: any) => { firstMsgMap[m._id] = m.firstSenderID; });

  // Lấy danh sách chat mà user đã reply (có ít nhất 1 tin nhắn từ user)
  const myRepliedChats = privateChatIDs.length > 0 ? await Message.aggregate([
    { $match: { chatID: { $in: privateChatIDs }, senderID: userID, type: { $nin: ['notification'] } } },
    { $group: { _id: '$chatID' } },
  ]) : [];
  const myRepliedSet = new Set(myRepliedChats.map((m: any) => m._id));

  // Filter out chats where current user has deletedAt set
  const filteredChats = chats
    .filter((c) => {
      const memberDoc = memberDocs.find((m) => m.chatID === c.chatID);
      const currentMember = memberDoc?.members.find((m) => m.userID === userID);
      return !currentMember?.deletedAt;
    })
    .map((c) => {
      const memberDoc = memberDocs.find((m) => m.chatID === c.chatID);
      const currentMember = memberDoc?.members.find((m) => m.userID === userID);
      const historyDeletedAt = currentMember?.historyDeletedAt;

      let messages = msgByChat[c.chatID] || [];
      if (historyDeletedAt) {
        messages = messages.filter((msg) => new Date(msg.timestamp) > historyDeletedAt);
      }

      const unreadCount = messages.filter(
        (msg) => msg.senderID !== userID && msg.status !== 'read'
      ).length;

      // Stranger check — không cần thêm DB query
      let isStranger = false;
      if (c.type === 'private') {
        const otherMember = membersByChat[c.chatID]?.find((m) => m.userID !== userID);
        if (otherMember && !friendIDs.has(otherMember.userID)) {
          const initiatorID = firstMsgMap[c.chatID];
          if (initiatorID === userID) {
            isStranger = false; // Mình gửi trước → không vào folder
          } else {
            isStranger = !myRepliedSet.has(c.chatID); // Chưa reply → stranger
          }
        }
      }

      return {
        ...c,
        lastMessage: messages,
        members: membersByChat[c.chatID] || [],
        unreadCount,
        isStranger,
      };
    });

  if (includeStrangers) {
    return filteredChats.filter((c) => c.isStranger);
  } else {
    return filteredChats.filter((c) => !c.isStranger);
  }
};

export default function chatRoutes(io: Server) {
  const router = Router();

  // POST /upload/audio — upload audio với validate type & size limit
  router.post('/upload/audio', authMiddleware, uploadAudio.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      console.log('Upload audio request:', { hasFile: !!file, mimetype: file?.mimetype, size: file?.size });
      if (!file) return res.status(400).json({ error: 'Không có file' }) as any;
      if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Chỉ chấp nhận file audio (mp3, wav, webm, ogg, mp4)' }) as any;
      }
      console.log('Uploading to Cloudinary...');
      const url = await uploadToCloudinary(file);
      console.log('Upload success:', url);
      res.json({ url, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype });
    } catch (e: any) {
      console.error('Upload audio error:', e);
      res.status(500).json({ error: 'Upload audio thất bại', detail: e.message });
    }
  });

  // POST /upload/document — upload PDF, Word, Excel với metadata
  router.post('/upload/document', authMiddleware, uploadDocument.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Không có file' }) as any;
      if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Chỉ chấp nhận PDF, Word (.doc/.docx), Excel (.xls/.xlsx)' }) as any;
      }
      const url = await uploadToCloudinary(file);
      res.json({ url, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype });
    } catch (e: any) {
      res.status(500).json({ error: 'Upload document thất bại', detail: e.message });
    }
  });

  // --- CHAT ROUTES ---

  // Lấy danh sách chat của user
  router.post('/chats/userID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const chats = await getChatsForUser(req.userID!, false); // false = exclude strangers
      res.json(chats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy danh sách tin nhắn từ người lạ (message requests)
  router.post('/chats/strangers', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const strangerChats = await getChatsForUser(req.userID!, true); // true = only strangers
      res.json(strangerChats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy thông tin tổng hợp tin nhắn từ người lạ (cho folder item)
  router.post('/chats/strangers/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const strangerChats = await getChatsForUser(req.userID!, true); // true = only strangers
      
      if (strangerChats.length === 0) {
        return res.json({
          count: 0,
          unreadCount: 0,
          lastMessageTime: null,
        }) as any;
      }

      // Tính tổng số tin nhắn chưa đọc
      const totalUnread = strangerChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

      // Tìm tin nhắn mới nhất
      let latestTimestamp: string | null = null;
      strangerChats.forEach((chat) => {
        const msgs = chat.lastMessage || [];
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          const msgTime = typeof lastMsg.timestamp === 'string' 
            ? lastMsg.timestamp 
            : new Date(lastMsg.timestamp).toISOString();
          if (!latestTimestamp || new Date(msgTime) > new Date(latestTimestamp)) {
            latestTimestamp = msgTime;
          }
        }
      });

      res.json({
        count: strangerChats.length,
        unreadCount: totalUnread,
        lastMessageTime: latestTimestamp,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy chat 1-1 giữa 2 người
  router.post('/chats1-1ByUserID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userID2 } = req.body;
      const userID1 = req.userID!;
      const matched = await ChatMember.find({ 'members.userID': { $all: [userID1, userID2] } }).lean();
      if (!matched.length) return res.status(404).json({ message: 'Chưa có chat 1-1' }) as any;

      const chatIDs = matched.map((m) => m.chatID);
      const privateChat = await Chat.findOne({ chatID: { $in: chatIDs }, type: 'private' }).lean();
      if (!privateChat) return res.status(404).json({ message: 'Không tìm thấy chat 1-1' }) as any;

      const memberDoc = await ChatMember.findOne({ chatID: privateChat.chatID }).lean();
      const msgs = await Message.find({ 
        chatID: privateChat.chatID,
        deletedFor: { $ne: userID1 } // ⭐ Filter deleted messages
      }).sort({ timestamp: 1 }).lean();
      const senderIDs = [...new Set(msgs.map((m) => m.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      const enriched = msgs.map((msg) => {
        const s = senders.find((u) => u.userID === msg.senderID);
        return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
      });

      res.json({ ...privateChat, members: memberDoc?.members || [], lastMessage: enriched });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Tạo chat 1-1 / Nhắn tin người lạ
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
      const members = [{ userID: userID1, role: 'admin' }, { userID: userID2, role: 'member' }];
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
      const userID = req.userID!;
      
      // Lấy thông tin member để check historyDeletedAt
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID }).lean();
      const currentMember = memberDoc?.members.find((m) => m.userID === userID);
      const historyDeletedAt = currentMember?.historyDeletedAt;
      
      // Lấy messages, filter theo historyDeletedAt nếu có
      const query: any = { chatID };
      if (historyDeletedAt) {
        query.timestamp = { $gt: historyDeletedAt.toISOString() };
      }
      
      const msgs = await Message.find(query).sort({ timestamp: 1 }).lean();
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
      console.log('Upload request:', { 
        fileCount: files?.length, 
        files: files?.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })) 
      });
      
      if (!files?.length) return res.status(400).json({ error: 'No files' }) as any;
      
      const urls = await Promise.all(files.map(async (f) => {
        try {
          console.log(`Uploading file: ${f.originalname} (${f.mimetype})`);
          const url = await uploadToCloudinary(f);
          console.log(`Upload success: ${f.originalname} -> ${url}`);
          return url;
        } catch (err: any) {
          console.error(`Upload failed for ${f.originalname}:`, err);
          throw new Error(`Failed to upload ${f.originalname}: ${err.message}`);
        }
      }));
      
      res.json({ urls });
    } catch (e: any) {
      console.error('Upload error:', e);
      res.status(500).json({ error: 'Upload failed', detail: e.message || String(e) });
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
      const messages = await Message.find({ 
        chatID,
        deletedFor: { $ne: userID } // ⭐ Filter deleted messages
      }).sort({ timestamp: 1 }).lean();
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
        deletedFor: { $ne: userID } // ⭐ Filter deleted messages
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
      const msgs = await Message.find({ 
        chatID, 
        type: { $in: typeFilter },
        deletedFor: { $ne: userID } // ⭐ Filter deleted messages
      }).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean();
      const total = await Message.countDocuments({ 
        chatID, 
        type: { $in: typeFilter },
        deletedFor: { $ne: userID } // ⭐ Filter deleted messages
      });
      res.json({ items: msgs, total, page: parseInt(page), hasMore: skip + msgs.length < total });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Xóa lịch sử trò chuyện (chỉ ẩn messages cho user hiện tại)
  router.delete('/chats/:chatID/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.params;
      const userID = req.userID!;
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      
      // Set historyDeletedAt cho member này để ẩn messages cũ
      await ChatMember.updateOne(
        { chatID, 'members.userID': userID },
        { $set: { 'members.$.historyDeletedAt': new Date() } }
      );
      
      console.log(`User ${userID} deleted history for chat ${chatID}`);
      
      res.json({ success: true, message: 'Đã xóa lịch sử trò chuyện' });
    } catch (e: any) {
      console.error('Delete history error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Xóa trò chuyện (ẩn khỏi danh sách của user)
  router.delete('/chats/:chatID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { chatID } = req.params;
      const userID = req.userID!;
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      
      // Set deletedAt cho member này để ẩn chat khỏi danh sách
      const result = await ChatMember.updateOne(
        { chatID, 'members.userID': userID },
        { $set: { 'members.$.deletedAt': new Date() } }
      );
      
      console.log(`Hide chat ${chatID} for user ${userID}:`, result);
      
      res.json({ success: true, deletedAt: new Date().toISOString() });
    } catch (e: any) {
      console.error('Delete chat error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // --- CONTACTS ROUTES (TV1) ---

  // Tìm kiếm bạn bè theo SĐT (Zalo Style)
  router.post('/contacts/search-friend-by-phone', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      const userID = req.userID!;
      const currentUser = await Users.findOne({ userID });
      if (currentUser && currentUser.sdt === phoneNumber) {
        return res.json({ ...currentUser.toObject(), friendStatus: 'self' }) as any;
      }

      const target = await Users.findOne({ sdt: phoneNumber });
      if (!target) return res.status(404).json({ message: 'Không tìm thấy người dùng' }) as any;

      const contact = await Contacts.findOne({
        $or: [
          { userID, contactID: target.userID },
          { userID: target.userID, contactID: userID },
        ],
      });

      let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked' = 'none';
      if (contact) {
        if (contact.status === 'pending') {
          friendStatus = contact.contactID === userID ? 'pending_sent' : 'pending_received';
        } else if (contact.status === 'accepted') {
          friendStatus = 'accepted';
        } else if (contact.status === 'blocked') {
          friendStatus = 'blocked';
        }
      }

      res.json({
        userID: target.userID,
        name: target.name,
        sdt: target.sdt,
        anhDaiDien: target.anhDaiDien,
        anhBia: target.anhBia,
        ngaysinh: target.ngaysinh,
        gioTinh: target.gioTinh,
        friendStatus,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Kiểm tra trạng thái bạn bè theo userID
  router.get('/contacts/friend-status/:targetUserID', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const { targetUserID } = req.params;

      if (userID === targetUserID) return res.json({ friendStatus: 'self' }) as any;

      const contact = await Contacts.findOne({
        $or: [
          { userID, contactID: targetUserID },
          { userID: targetUserID, contactID: userID },
        ],
      });

      let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked' = 'none';
      if (contact) {
        if (contact.status === 'pending') {
          friendStatus = contact.contactID === userID ? 'pending_sent' : 'pending_received';
        } else if (contact.status === 'accepted') {
          friendStatus = 'accepted';
        } else if (contact.status === 'blocked') {
          friendStatus = 'blocked';
        }
      }

      res.json({ friendStatus });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Gửi lời mời kết bạn (Zalo Style - Alias & Message)
  router.post('/contacts/send-friend-request', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const senderID = req.userID!;
      const { recipientPhone, alias, message } = req.body;

      const target = await Users.findOne({ sdt: recipientPhone });
      if (!target) return res.status(404).json({ message: 'Không tìm thấy người dùng' }) as any;
      if (target.userID === senderID) return res.status(400).json({ message: 'Không thể kết bạn với chính mình' }) as any;

      const existing = await Contacts.findOne({
        $or: [
          { userID: target.userID, contactID: senderID },
          { userID: senderID, contactID: target.userID },
        ],
      });

      if (existing?.status === 'accepted') return res.status(400).json({ message: 'Đã là bạn bè' }) as any;
      if (existing?.status === 'pending') return res.status(400).json({ message: 'Đã gửi lời mời trước đó' }) as any;

      const newContact = await Contacts.create({
        contactID: senderID,
        userID: target.userID,
        alias: alias || target.name,
        message: message || 'Mình kết bạn nhé!',
        status: 'pending',
        created_at: new Date(),
      });

      const sender = await Users.findOne({ userID: senderID });
      io.to(target.userID).emit('new_friend_request', {
        contactID: senderID,
        userID: target.userID,
        name: sender?.name,
        avatar: sender?.anhDaiDien,
        sdt: sender?.sdt,
        anhBia: sender?.anhBia,
        ngaysinh: sender?.ngaysinh,
        gioTinh: sender?.gioTinh,
        alias: newContact.alias,
        message: newContact.message,
      });

      res.status(201).json({ message: 'Đã gửi lời mời kết bạn' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Chấp nhận kết bạn
  router.post('/contacts/accept-friend-request', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const { senderID } = req.body;
      const contact = await Contacts.findOneAndUpdate(
        { userID, contactID: senderID, status: 'pending' },
        { status: 'accepted' },
        { new: true }
      );
      if (!contact) return res.status(404).json({ message: 'Không tìm thấy lời mời' }) as any;

      // Tạo contact ngược từ người gửi về người nhận
      const reverseContact = await Contacts.findOne({ userID: senderID, contactID: userID });
      if (!reverseContact) {
        const sender = await Users.findOne({ userID: senderID });
        await Contacts.create({
          userID: senderID,
          contactID: userID,
          alias: sender?.name || 'Bạn',
          status: 'accepted',
          created_at: new Date(),
        });
      } else if (reverseContact.status !== 'accepted') {
        await Contacts.findOneAndUpdate(
          { userID: senderID, contactID: userID },
          { status: 'accepted' },
          { new: true }
        );
      }

      const sender = await Users.findOne({ userID: senderID });
      const receiver = await Users.findOne({ userID });
      
      io.to(senderID).emit('friend_request_accepted', { 
        userID, 
        name: receiver?.name, 
        anhDaiDien: receiver?.anhDaiDien,
        actorID: userID 
      });

      io.to(userID).emit('friend_request_accepted', { 
        userID: senderID, 
        name: sender?.name, 
        anhDaiDien: sender?.anhDaiDien,
        actorID: userID 
      });
      res.json({ message: 'Đã chấp nhận kết bạn' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Từ chối kết bạn
  router.post('/contacts/reject-friend-request', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const { senderID } = req.body;
      const contact = await Contacts.findOneAndDelete({ userID, contactID: senderID, status: 'pending' });
      if (!contact) return res.status(404).json({ message: 'Không tìm thấy lời mời' }) as any;

      io.to(senderID).emit('friend_request_rejected', { senderID, recipientID: userID });
      io.to(userID).emit('friend_request_rejected', { senderID, recipientID: userID });
      
      res.json({ message: 'Đã từ chối kết bạn' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy danh sách bạn bè (Zalo Style - Có Alias)
  router.post('/contacts/friends', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const friends = await Contacts.find({
        $or: [
          { userID, status: 'accepted' },
          { contactID: userID, status: 'accepted' },
        ],
      }).lean();

      const result = await Promise.all(friends.map(async (f) => {
        const friendID = f.userID === userID ? f.contactID : f.userID;
        const friendUser = await Users.findOne({ userID: friendID }).select('name anhDaiDien sdt trangThai anhBia ngaysinh gioTinh').lean();
        
        // Lấy alias từ contact record của người dùng hiện tại
        const contactRecord = f.userID === userID ? f : await Contacts.findOne({ userID, contactID: friendID }).lean();
        
        return { 
          userID: friendID, 
          name: friendUser?.name, 
          anhDaiDien: friendUser?.anhDaiDien, 
          sdt: friendUser?.sdt, 
          trangThai: friendUser?.trangThai,
          anhBia: friendUser?.anhBia,
          ngaysinh: friendUser?.ngaysinh,
          gioTinh: friendUser?.gioTinh,
          alias: contactRecord?.alias || friendUser?.name
        };
      }));

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy danh sách lời mời kết bạn đang chờ (Zalo Style - Có message)
  router.get('/contacts/friend-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const pending = await Contacts.find({ userID, status: 'pending' }).lean();
      const result = await Promise.all(pending.map(async (r) => {
        const sender = await Users.findOne({ userID: r.contactID }).select('userID name anhDaiDien sdt anhBia ngaysinh gioTinh').lean();
        return { 
          contactID: r.contactID, 
          userID, 
          name: sender?.name, 
          avatar: sender?.anhDaiDien, 
          sdt: sender?.sdt,
          anhBia: sender?.anhBia,
          ngaysinh: sender?.ngaysinh,
          gioTinh: sender?.gioTinh,
          message: r.message 
        };
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lấy danh sách lời mời ĐÃ GỬI (Zalo Style)
  router.get('/contacts/sent-friend-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const sent = await Contacts.find({ contactID: userID, status: 'pending' }).lean();
      const result = await Promise.all(sent.map(async (r) => {
        const target = await Users.findOne({ userID: r.userID }).select('userID name anhDaiDien sdt anhBia ngaysinh gioTinh').lean();
        return { 
          recipientID: r.userID, 
          senderID: userID, 
          name: target?.name, 
          avatar: target?.anhDaiDien, 
          sdt: target?.sdt,
          anhBia: target?.anhBia,
          ngaysinh: target?.ngaysinh,
          gioTinh: target?.gioTinh,
          message: r.message 
        };
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Thu hồi lời mời kết bạn
  router.post('/contacts/cancel-friend-request', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const senderID = req.userID!;
      const { recipientID } = req.body;
      const contact = await Contacts.findOneAndDelete({ contactID: senderID, userID: recipientID, status: 'pending' });
      
      if (!contact) return res.status(404).json({ message: 'Không tìm thấy lời mời để thu hồi' }) as any;

      io.to(recipientID).emit('friend_request_cancelled', { senderID, recipientID });
      io.to(senderID).emit('friend_request_cancelled', { senderID, recipientID });
      
      res.json({ message: 'Đã thu hồi lời mời kết bạn' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Hủy kết bạn
  router.post('/contacts/unfriend', authMiddleware, async (req: AuthRequest, res: Response) => {
    console.log('🔴 Unfriend request received:', { userID: req.userID, body: req.body });
    try {
      const userID = req.userID!;
      const { friendID } = req.body;
      
      console.log('🔍 Looking for contact:', { userID, friendID });
      
      const contact = await Contacts.findOneAndDelete({
        $or: [
          { userID, contactID: friendID, status: 'accepted' },
          { userID: friendID, contactID: userID, status: 'accepted' },
        ],
      });

      console.log('📋 Contact found:', contact);

      if (!contact) {
        console.log('❌ Contact not found');
        return res.status(404).json({ message: 'Không tìm thấy quan hệ bạn bè' }) as any;
      }

      io.to(friendID).emit('friend_unfriended', { userID, friendID });
      io.to(userID).emit('friend_unfriended', { userID, friendID });

      console.log('✅ Unfriend successful');
      res.json({ message: 'Đã hủy kết bạn' });
    } catch (e: any) {
      console.error('❌ Unfriend error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Cập nhật tên gợi nhớ (Alias) - Chỉ cho phép người thiết lập thấy
  router.post('/contacts/update-alias', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const { contactID, alias } = req.body;
      
      // Tìm quan hệ bạn bè. Alias trong DB hiện tại đang gán cho người nhận lời mời.
      // Để đơn giản theo schema hiện tại, ta cập nhật alias của bản ghi contact chung.
      const contact = await Contacts.findOneAndUpdate(
        {
          $or: [
            { userID: contactID, contactID: userID },
            { userID, contactID: contactID },
          ],
          status: 'accepted'
        },
        { alias: alias || '' },
        { new: true }
      );

      if (!contact) return res.status(404).json({ message: 'Không tìm thấy quan hệ bạn bè' }) as any;

      res.json({ message: 'Đã cập nhật tên gợi nhớ', alias: contact.alias });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return router;
}
