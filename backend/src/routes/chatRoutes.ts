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
import GroupMember from '../models/GroupMember';
import Group from '../models/Group';
import GroupMessage from '../models/GroupMessage';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
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

// Helper: lấy danh sách chat đầy đủ cho user (bao gồm 1-1 chats và group chats)
export const getChatsForUser = async (userID: string, includeStrangers: boolean = false) => {
  // ===== FETCH 1-1 CHATS =====
  const memberDocs = await ChatMember.find({ 'members.userID': userID }).lean();
  console.log(`  → Found ${memberDocs.length} ChatMember records for ${userID}`);

  const chatIDs = memberDocs.map((m) => m.chatID);

  // Get 1-1 chats
  const chats = chatIDs.length > 0 ? await Chat.find({ chatID: { $in: chatIDs } }).lean() : [];
  if (process.env.NODE_ENV === 'development') {
    console.log(`  → Found ${chats.length} Chat records`);
  }

  // Chỉ lấy 50 tin nhắn gần nhất mỗi chat thay vì toàn bộ
  const allMessages = chatIDs.length > 0 ? await Message.aggregate([
    { $match: { chatID: { $in: chatIDs }, deletedFor: { $ne: userID } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: '$chatID', messages: { $push: '$$ROOT' } } },
    { $project: { messages: { $slice: ['$messages', -50] } } }, // 50 tin nhắn gần nhất
  ]) : [];

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
      const hasDeletedAt = !!currentMember?.deletedAt;
      // Đã xóa log debug
      return !hasDeletedAt;
    })
    .map((c) => {
      const memberDoc = memberDocs.find((m) => m.chatID === c.chatID);
      const currentMember = memberDoc?.members.find((m) => m.userID === userID);
      const historyDeletedAt = currentMember?.historyDeletedAt;

      let messages = msgByChat[c.chatID] || [];
      if (historyDeletedAt) {
        messages = messages.filter((msg: any) => new Date(msg.timestamp) > historyDeletedAt);
      }

      const unreadCount = messages.filter(
        (msg: any) => msg.senderID !== userID && msg.status !== 'read'
      ).length;

      // Stranger check — không cần thêm DB query
      // Stranger check
      let isStranger = false;
      if (c.type === 'private') {
        const otherMember = membersByChat[c.chatID]?.find((m) => m.userID !== userID);
        if (otherMember && !friendIDs.has(otherMember.userID)) {
          // Chỉ là người lạ nếu không phải bạn bè VÀ người dùng hiện tại CHƯA TỪNG NHẮN TIN (chưa từng reply)
          // Nếu đã từng nhắn tin thì vẫn giữ ở danh sách chính
          if (!myRepliedSet.has(c.chatID)) {
            isStranger = true;
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

  // ===== FETCH GROUP CHATS =====
  const groupMembers = await GroupMember.find({ userID, isActive: true }).lean();
  if (process.env.NODE_ENV === 'development') {
    console.log(`  → Found ${groupMembers.length} GroupMember records for ${userID}`);
  }

  const groupIDs = groupMembers.map((gm) => gm.groupID);

  // Get group details
  const groups = groupIDs.length > 0 ? await Group.find({ groupID: { $in: groupIDs }, isActive: true }).lean() : [];
  if (process.env.NODE_ENV === 'development') {
    console.log(`  → Found ${groups.length} Group records`);
  }

  // Get group messages (50 most recent per group)
  const groupMessages = groupIDs.length > 0 ? await GroupMessage.aggregate([
    { $match: { groupID: { $in: groupIDs }, deletedFor: { $ne: userID } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: '$groupID', messages: { $push: '$$ROOT' } } },
    { $project: { messages: { $slice: ['$messages', -50] } } }, // 50 tin nhắn gần nhất
  ]) : [];

  const flatGroupMessages = groupMessages.flatMap((g: any) => g.messages);
  const groupSenderIDs = [...new Set(flatGroupMessages.map((m: any) => m.senderID))];
  const groupSenders = groupSenderIDs.length > 0 ? await Users.find({ userID: { $in: groupSenderIDs } }).lean() : [];

  const enrichedGroupMessages = flatGroupMessages.map((msg: any) => {
    const s = groupSenders.find((u) => u.userID === msg.senderID);
    // Clean pinnedInfo nếu là object rỗng hoặc không có pinnedBy
    const cleanedMsg = { ...msg };
    if (cleanedMsg.pinnedInfo && !cleanedMsg.pinnedInfo.pinnedBy) {
      delete cleanedMsg.pinnedInfo;
    }
    return { ...cleanedMsg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
  });

  const msgByGroup: Record<string, typeof enrichedGroupMessages> = {};
  enrichedGroupMessages.forEach((m: any) => {
    if (!msgByGroup[m.groupID]) msgByGroup[m.groupID] = [];
    msgByGroup[m.groupID].push(m);
  });

  // Get all group members for each group (CHỈ LẤY ACTIVE MEMBERS)
  const allGroupMembers = groupIDs.length > 0 ? await GroupMember.find({ 
    groupID: { $in: groupIDs },
    isActive: true  // ⭐ CHỈ LẤY MEMBERS ĐANG ACTIVE
  }).lean() : [];
  
  console.log(`👥 [BACKEND] getChatsForUser - Total active group members:`, allGroupMembers.length);
  
  const membersByGroup: Record<string, { userID: string; role: string }[]> = {};
  allGroupMembers.forEach((gm) => {
    if (!membersByGroup[gm.groupID]) membersByGroup[gm.groupID] = [];
    membersByGroup[gm.groupID].push({ userID: gm.userID, role: gm.role });
  });

  // Convert groups to chat format
  const groupChats = groups.map((g) => {
    const messages = msgByGroup[g.groupID] || [];
    const unreadCount = messages.filter(
      (msg) => msg.senderID !== userID && !msg.seenBy?.some((s: any) => s.userID === userID)
    ).length;

    return {
      chatID: g.groupID,
      type: 'group',
      name: g.name,
      avatar: g.avatar || '',
      description: g.description || '',
      lastMessage: messages,
      members: membersByGroup[g.groupID] || [],
      unreadCount,
      isStranger: false, // Group chats are never strangers
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  });

  // ===== MERGE 1-1 AND GROUP CHATS =====
  const allChats = [...filteredChats, ...groupChats];

  if (includeStrangers) {
    return allChats.filter((c) => c.isStranger);
  } else {
    return allChats.filter((c) => !c.isStranger);
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
        return res.status(400).json({ error: 'Chỉ chấp nhận file audio (mp3, wav, webm, ogg, mp4, m4a)' }) as any;
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

  // Debug: Fix tất cả alias trong database (cho admin)
  router.post('/debug/fix-all-alias', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const contacts = await Contacts.find({}).lean();
      let fixed = 0;

      for (const contact of contacts) {
        // ⭐ alias phải là tên của contactID, không phải userID
        const friend = await Users.findOne({ userID: contact.contactID });
        if (friend && contact.alias !== friend.name) {
          await Contacts.findByIdAndUpdate(contact._id, { alias: friend.name });
          fixed++;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Fixed: userID=${contact.userID}, contactID=${contact.contactID}, old alias="${contact.alias}" → new alias="${friend.name}"`);
          }
        }
      }

      res.json({ message: `Fixed ${fixed}/${contacts.length} contacts`, total: contacts.length, fixed });
    } catch (e: any) {
      console.error('fix-all-alias error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Debug: Xóa tất cả contacts của user
  router.post('/debug/delete-my-contacts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;

      const result = await Contacts.deleteMany({
        $or: [
          { userID },
          { contactID: userID }
        ]
      });

      res.json({ message: `Deleted ${result.deletedCount} contacts` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Debug: Fix alias trong database
  router.post('/debug/fix-alias', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;

      // Lấy tất cả contacts của user
      const contacts = await Contacts.find({ userID }).lean();

      for (const contact of contacts) {
        // Lấy tên thật của contactID
        const friend = await Users.findOne({ userID: contact.contactID });
        if (friend && contact.alias !== friend.name) {
          await Contacts.findByIdAndUpdate(contact._id, { alias: friend.name });
        }
      }

      res.json({ message: `Fixed ${contacts.length} contacts` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Debug: Tạo chat test
  router.post('/debug/create-test-chat', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const { userID2 } = req.body;

      if (!userID2) return res.status(400).json({ message: 'userID2 required' });

      const chatID = `chat_${Date.now()}`;
      const members = [{ userID, role: 'admin' }, { userID: userID2, role: 'member' }];

      await Chat.create({
        chatID,
        type: 'private',
        name: `Test Chat`,
        created_at: new Date(),
      });

      await ChatMember.create({ chatID, members });

      res.json({ message: 'Chat created', chatID });
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
          const contact = await Contacts.findOne({
            $or: [
              { userID: userID1, contactID: userID2 },
              { userID: userID2, contactID: userID1 },
            ],
            status: 'accepted'
          });
          const isStranger = !contact;
          return res.json({ ...found, members: memberDoc?.members || [], lastMessage: [], isStranger }) as any;
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

      const contact = await Contacts.findOne({
        $or: [
          { userID: userID1, contactID: userID2 },
          { userID: userID2, contactID: userID1 },
        ],
        status: 'accepted'
      });
      const isStranger = !contact;

      const result = { ...newChat.toObject(), members, lastMessage: [] };
      io.to(userID1).emit('newChat1-1', { ...result, isStranger });
      io.to(userID2).emit('newChat1-1', { ...result, isStranger });
      res.status(201).json({ ...result, isStranger });
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

      // Hỗ trợ phân trang: nếu client gửi page và limit
      const { page, limit } = req.body;
      const isPagination = page && limit;
      
      let msgs;
      if (isPagination) {
        const skip = (Number(page) - 1) * Number(limit);
        msgs = await Message.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean();
        msgs.reverse(); // Đảo ngược để gửi về mảng thứ tự: [cũ nhất của page -> mới nhất của page]
      } else {
        // Fallback cho logic cũ không có phân trang
        msgs = await Message.find(query).sort({ timestamp: 1 }).lean();
      }

      const senderIDs = [...new Set(msgs.map((m) => m.senderID))];
      const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
      const enriched = msgs.map((msg) => {
        const s = senders.find((u) => u.userID === msg.senderID);
        return { ...msg, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : null };
      });

      if (isPagination) {
        const total = await Message.countDocuments(query);
        res.json({
          messages: enriched,
          page: Number(page),
          total,
          limit: Number(limit)
        });
      } else {
        res.json(enriched); // Tương thích ngược
      }
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
      const { chatID, keyword, senderID, fromDate, toDate } = req.query as Record<string, string>;
      const userID = req.userID!;
      if (!chatID || !keyword?.trim()) return res.json([]);
      const memberDoc = await ChatMember.findOne({ chatID, 'members.userID': userID });
      if (!memberDoc) return res.status(403).json({ message: 'Forbidden' });
      const query: any = {
        chatID,
        type: { $in: ['text', 'emoji'] },
        content: { $regex: keyword.trim(), $options: 'i' },
        deletedFor: { $ne: userID }
      };
      if (senderID) query.senderID = senderID;
      if (fromDate || toDate) {
        query.timestamp = {};
        if (fromDate) query.timestamp.$gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          query.timestamp.$lte = end;
        }
      }
      const msgs = await Message.find(query).sort({ timestamp: -1 }).limit(50).lean();
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

      // ⭐ XÓA TẤT CẢ REMINDER CỦA USER TRONG CHAT NÀY
      const Reminder = (await import('../models/Reminder')).default;
      const deletedReminders = await Reminder.deleteMany({ chatID, userID });
      
      // ⭐ XÓA TẤT CẢ REMINDER EVENTS CỦA USER TRONG CHAT NÀY
      const ReminderEvent = (await import('../models/ReminderEvent')).default;
      const deletedEvents = await ReminderEvent.deleteMany({ chatID, userID });
      
      console.log(`🗑️ Deleted ${deletedReminders.deletedCount} reminders and ${deletedEvents.deletedCount} reminder events for user ${userID} in chat ${chatID}`);

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

      // ⭐ XÓA TẤT CẢ REMINDER CỦA USER TRONG CHAT NÀY
      const Reminder = (await import('../models/Reminder')).default;
      const deletedReminders = await Reminder.deleteMany({ chatID, userID });
      
      // ⭐ XÓA TẤT CẢ REMINDER EVENTS CỦA USER TRONG CHAT NÀY
      const ReminderEvent = (await import('../models/ReminderEvent')).default;
      const deletedEvents = await ReminderEvent.deleteMany({ chatID, userID });
      
      console.log(`🗑️ Deleted ${deletedReminders.deletedCount} reminders and ${deletedEvents.deletedCount} reminder events for user ${userID} in chat ${chatID}`);

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

      let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked' | 'blocked_by_other' = 'none';

      // Kiểm tra xem mình có đang chặn người này không
      if (currentUser?.blockedUsers?.includes(target.userID)) {
        friendStatus = 'blocked';
      }
      // Kiểm tra xem người này có đang chặn mình không
      else if (target.blockedUsers?.includes(userID)) {
        friendStatus = 'blocked_by_other';
      }
      else if (contact) {
        if (contact.status === 'pending') {
          friendStatus = contact.contactID === userID ? 'pending_sent' : 'pending_received';
        } else if (contact.status === 'accepted') {
          friendStatus = 'accepted';
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

      let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked' | 'blocked_by_other' = 'none';

      // Kiểm tra chặn
      const currentUser = await Users.findOne({ userID });
      const targetUser = await Users.findOne({ userID: targetUserID });

      if (currentUser?.blockedUsers?.includes(targetUserID as string)) {
        friendStatus = 'blocked';
      } else if (targetUser?.blockedUsers?.includes(userID)) {
        friendStatus = 'blocked_by_other';
      } else if (contact) {
        if (contact.status === 'pending') {
          friendStatus = contact.contactID === userID ? 'pending_sent' : 'pending_received';
        } else if (contact.status === 'accepted') {
          friendStatus = 'accepted';
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

      //  FIX: alias phải là tên của contactID (người gửi), không phải target (người nhận)
      const sender = await Users.findOne({ userID: senderID });

      const newContact = await Contacts.create({
        contactID: senderID,
        userID: target.userID,
        alias: alias || sender?.name || 'Bạn', // Tên của contactID (người gửi)
        message: message || 'Mình kết bạn nhé!',
        status: 'pending',
        created_at: new Date(),
      });

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

      // Lấy thông tin sender và receiver trước
      const sender = await Users.findOne({ userID: senderID });
      const receiver = await Users.findOne({ userID });

      // Update contact từ người nhận (userID) về người gửi (senderID)
      const contact = await Contacts.findOneAndUpdate(
        { userID, contactID: senderID, status: 'pending' },
        { status: 'accepted', alias: sender?.name || 'Bạn' }, // ⭐ Đảm bảo alias là tên sender
        { new: true }
      );
      if (!contact) return res.status(404).json({ message: 'Không tìm thấy lời mời' }) as any;

      // Tạo contact ngược từ người gửi về người nhận
      // userID: senderID, contactID: userID
      // ⭐ alias phải là tên của contactID (tức là tên của userID - người nhận)
      const reverseContact = await Contacts.findOne({ userID: senderID, contactID: userID });
      if (!reverseContact) {
        await Contacts.create({
          userID: senderID,
          contactID: userID,
          alias: receiver?.name || 'Bạn', // ✅ Tên của contactID (người nhận)
          status: 'accepted',
          created_at: new Date(),
        });
      } else if (reverseContact.status !== 'accepted') {
        await Contacts.findOneAndUpdate(
          { userID: senderID, contactID: userID },
          { status: 'accepted', alias: receiver?.name || 'Bạn' },
          { new: true }
        );
      }

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

      // ── TỰ ĐỘNG TẠO CHAT VÀ GỬI THÔNG BÁO HỆ THỐNG ──────────────────────────
      try {
        console.log(`[Friendship] Accepted: ${senderID} <-> ${userID}. Managing chat...`);
        // Tìm chat 1-1 đã tồn tại
        const existingMembers = await ChatMember.find({
          'members.userID': { $all: [userID, senderID] }
        }).lean();

        let chat: any = null;
        if (existingMembers.length) {
          const chatIDs = existingMembers.map((m) => m.chatID);
          chat = await Chat.findOne({ chatID: { $in: chatIDs }, type: 'private' }).lean();
          if (chat) {
            const memberDoc = await ChatMember.findOne({ chatID: chat.chatID }).lean();
            chat.members = memberDoc?.members || [];
          }
        }

        let isNewChat = false;
        if (!chat) {
          isNewChat = true;
          const chatID = await generateChatID();
          const members = [
            { userID: senderID, role: 'admin' },
            { userID, role: 'member' }
          ];
          const newChatDoc = await Chat.create({
            chatID,
            type: 'private',
            avatar: sender?.anhDaiDien || '',
            name: `${sender?.name || 'User'} & ${receiver?.name || 'User'}`,
            created_at: new Date(),
          });
          await ChatMember.create({ chatID, members });
          chat = { ...newChatDoc.toObject(), members };
        }

        if (chat) {
          // 1. Thông báo cập nhật danh sách chat trước
          console.log(`[Socket] Emitting newChat1-1 (isStranger: false) to users`);
          io.to(senderID).emit('newChat1-1', { ...chat, isStranger: false });
          io.to(userID).emit('newChat1-1', { ...chat, isStranger: false });

          // 2. Tạo tin nhắn hệ thống trong DB
          const systemMsgObj = {
            messageID: `msg-sys-${Date.now()}`,
            chatID: chat.chatID,
            senderID: 'system',
            content: isNewChat
              ? `##FRIENDSHIP##|${senderID}|${userID}|${sender?.name}|${receiver?.name}|new`
              : `##FRIENDSHIP##|${senderID}|${userID}|${sender?.name}|${receiver?.name}`,
            type: 'notification',
            timestamp: new Date(),
            status: 'sent',
          };

          await Message.create(systemMsgObj);

          // 3. Phát tin nhắn qua socket với đầy đủ senderInfo để tránh lỗi UI
          const fullSystemMsg = {
            ...systemMsgObj,
            senderInfo: { name: 'Hệ thống', avatar: null }
          };

          console.log(`[Socket] Emitting new_message (system) to users`);
          io.to(senderID).emit('new_message', fullSystemMsg);
          io.to(userID).emit('new_message', fullSystemMsg);
        }
      } catch (chatError) {
        console.error('Lỗi tự động tạo chat khi kết bạn:', chatError);
      }

      res.json({ message: 'Đã chấp nhận kết bạn' });
    } catch (e: any) {
      console.error('accept-friend-request error:', e);
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
      // Chỉ lấy contact records nơi userID là người dùng hiện tại
      // Để tránh duplicate (vì mỗi friendship có 2 records)
      const friends = await Contacts.find({
        userID,
        status: 'accepted',
      }).lean();

      const result = await Promise.all(friends.map(async (f) => {
        const friendID = f.contactID;
        const friendUser = await Users.findOne({ userID: friendID }).select('name anhDaiDien sdt trangThai anhBia ngaysinh gioTinh').lean();

        return {
          userID: friendID,
          name: friendUser?.name,
          anhDaiDien: friendUser?.anhDaiDien,
          sdt: friendUser?.sdt,
          trangThai: friendUser?.trangThai,
          anhBia: friendUser?.anhBia,
          ngaysinh: friendUser?.ngaysinh,
          gioTinh: friendUser?.gioTinh,
          // Nếu có alias (biệt danh do người dùng đặt), dùng alias; nếu không, dùng tên thật
          alias: f.alias?.trim() ? f.alias : undefined
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

    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Chặn người dùng
  router.post('/contacts/block', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = String(req.userID!);
      const { targetUserID } = req.body;

      console.log(`[API] Blocking request: ${userID} -> ${targetUserID}`);

      if (!targetUserID || typeof targetUserID !== 'string') {
        return res.status(400).json({ message: 'targetUserID không hợp lệ' }) as any;
      }

      if (userID === targetUserID) return res.status(400).json({ message: 'Không thể tự chặn chính mình' }) as any;

      const updateResult = await Users.findOneAndUpdate(
        { userID: userID },
        { $addToSet: { blockedUsers: targetUserID } },
        { new: true }
      );

      if (!updateResult) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng hiện tại' }) as any;
      }

      // Notify cả 2 phía để đồng bộ real-time
      io.to(userID).emit('friend_status_update', { userID: targetUserID, friendStatus: 'blocked', ownerID: userID });
      io.to(targetUserID).emit('friend_status_update', { userID, friendStatus: 'blocked_by_other', ownerID: userID });

      res.json({ message: 'Đã chặn người dùng này', friendStatus: 'blocked' });
    } catch (e: any) {
      console.error('🔥 CRITICAL API ERROR (block):', e);
      res.status(500).json({ message: 'Lỗi hệ thống khi thực hiện chặn' });
    }
  });

  // Bỏ chặn người dùng
  router.post('/contacts/unblock', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = String(req.userID!);
      const { targetUserID } = req.body;

      console.log(`[API] Unblocking request: ${userID} -> ${targetUserID}`);

      if (!targetUserID || typeof targetUserID !== 'string') {
        return res.status(400).json({ message: 'targetUserID không hợp lệ' }) as any;
      }

      const result = await Users.findOneAndUpdate(
        { userID: userID },
        { $pull: { blockedUsers: targetUserID } },
        { new: true }
      );

      if (!result) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' }) as any;
      }

      // Notify cả 2 phía để đồng bộ real-time
      io.to(userID).emit('friend_status_update', { userID: targetUserID, friendStatus: 'none', ownerID: userID });
      io.to(targetUserID).emit('friend_status_update', { userID, friendStatus: 'none', ownerID: userID });

      res.json({ message: 'Đã bỏ chặn người dùng này', status: 'success' });
    } catch (e: any) {
      console.error('🔥 CRITICAL API ERROR (unblock):', e);
      res.status(500).json({ message: 'Lỗi hệ thống khi gỡ chặn' });
    }
  });

  // Danh sách người dùng đã chặn
  router.get('/contacts/blocked', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userID = req.userID!;
      const currentUser = await Users.findOne({ userID }).lean();
      if (!currentUser?.blockedUsers?.length) return res.json([]) as any;
      const blockedUsers = await Users.find({ userID: { $in: currentUser.blockedUsers } })
        .select('userID name sdt anhDaiDien trangThai')
        .lean();
      res.json(blockedUsers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Tạo chat với người lạ (không cần kết bạn)
  router.post('/chats/stranger', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { userID2 } = req.body;
      const userID1 = req.userID!;
      if (!userID2) return res.status(400).json({ message: 'userID2 required' }) as any;

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
        chatID, type: 'private',
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

  return router;
}
