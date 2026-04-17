import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Group from '../models/Group';
import GroupMember from '../models/GroupMember';
import GroupMessage from '../models/GroupMessage';
import Users from '../models/User';

const router = Router();

// ==================== GROUP MANAGEMENT ====================

// 1. Tạo nhóm
router.post('/groups/create', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, avatar, memberIDs } = req.body;
    const userID = req.userID;

    if (!name) {
      res.status(400).json({ message: 'Tên nhóm không được để trống' });
      return;
    }

    // Kiểm tra tối thiểu 3 thành viên (bao gồm owner)
    const totalMembers = (memberIDs?.length || 0) + 1; // +1 cho owner
    if (totalMembers < 3) {
      res.status(400).json({
        message: 'Nhóm phải có ít nhất 3 thành viên',
        required: 3,
        current: totalMembers,
        needMore: 3 - totalMembers,
      });
      return;
    }

    const groupID = `grp_${uuidv4()}`;

    // Tạo group
    const group = new Group({
      groupID,
      name,
      description,
      avatar,
      ownerID: userID,
    });
    await group.save();

    // Thêm owner vào group
    const ownerMember = new GroupMember({
      groupID,
      userID,
      role: 'owner',
    });
    await ownerMember.save();

    // Thêm các thành viên khác
    if (memberIDs && Array.isArray(memberIDs)) {
      const members = memberIDs.map((id: string) => ({
        groupID,
        userID: id,
        role: 'member',
      }));
      await GroupMember.insertMany(members);
    }

    res.status(201).json({
      message: 'Tạo nhóm thành công',
      group: {
        groupID,
        name,
        avatar,
        ownerID: userID,
        totalMembers: totalMembers,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tạo nhóm', error: error.message });
  }
});

// 2. Lấy danh sách nhóm của user
router.get('/groups', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userID = req.userID;

    const memberRecords = await GroupMember.find({
      userID,
      isActive: true,
    }).select('groupID');

    const groupIDs = memberRecords.map((m) => m.groupID);

    const groups = await Group.find({
      groupID: { $in: groupIDs },
      isActive: true,
    }).sort({ updatedAt: -1 });

    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy danh sách nhóm', error: error.message });
  }
});

// 3. Lấy chi tiết nhóm
router.get('/groups/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    // Kiểm tra user có trong group không
    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      return;
    }

    const group = await Group.findOne({ groupID, isActive: true });
    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại' });
      return;
    }

    // Lấy danh sách thành viên
    const members = await GroupMember.find({ groupID, isActive: true }).populate('userID');

    res.json({
      ...group.toObject(),
      members,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết nhóm', error: error.message });
  }
});

// 4. Cập nhật thông tin nhóm
router.put('/groups/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { name, description, avatar } = req.body;
    const userID = req.userID;

    // Kiểm tra quyền (chỉ owner/admin)
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa nhóm' });
      return;
    }

    const group = await Group.findOneAndUpdate(
      { groupID },
      { name, description, avatar, updatedAt: new Date() },
      { new: true }
    );

    res.json({ message: 'Cập nhật nhóm thành công', group });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật nhóm', error: error.message });
  }
});

// 5. Thêm thành viên vào nhóm
router.post('/groups/:groupID/members', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { userID: newUserID } = req.body;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền thêm thành viên' });
      return;
    }

    // Kiểm tra user mới có tồn tại không
    const newUser = await Users.findOne({ userID: newUserID });
    if (!newUser) {
      res.status(404).json({ message: 'Người dùng không tồn tại' });
      return;
    }

    // Kiểm tra user đã trong group chưa
    const existing = await GroupMember.findOne({ groupID, userID: newUserID });
    if (existing && existing.isActive) {
      res.status(400).json({ message: 'Người dùng đã trong nhóm' });
      return;
    }

    // Thêm hoặc kích hoạt lại
    if (existing) {
      existing.isActive = true;
      existing.leftAt = undefined;
      await existing.save();
    } else {
      const newMember = new GroupMember({
        groupID,
        userID: newUserID,
        role: 'member',
      });
      await newMember.save();
    }

    res.json({ message: 'Thêm thành viên thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi thêm thành viên', error: error.message });
  }
});

// 6. Xóa thành viên khỏi nhóm
router.delete('/groups/:groupID/members/:targetUserID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, targetUserID } = req.params;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền xóa thành viên' });
      return;
    }

    // Không cho xóa owner
    const targetMember = await GroupMember.findOne({ groupID, userID: targetUserID });
    if (targetMember?.role === 'owner') {
      res.status(400).json({ message: 'Không thể xóa chủ nhóm' });
      return;
    }

    await GroupMember.findOneAndUpdate(
      { groupID, userID: targetUserID },
      { isActive: false, leftAt: new Date() }
    );

    res.json({ message: 'Xóa thành viên thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa thành viên', error: error.message });
  }
});

// 7. Rời nhóm
router.post('/groups/:groupID/leave', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(404).json({ message: 'Bạn không trong nhóm này' });
      return;
    }

    if (member.role === 'owner') {
      res.status(400).json({ message: 'Chủ nhóm không thể rời nhóm. Hãy chuyển quyền trước' });
      return;
    }

    member.isActive = false;
    member.leftAt = new Date();
    await member.save();

    res.json({ message: 'Rời nhóm thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi rời nhóm', error: error.message });
  }
});

// 8. Phân quyền thành viên
router.put('/groups/:groupID/members/:targetUserID/role', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, targetUserID } = req.params;
    const { role } = req.body;
    const userID = req.userID;

    // Chỉ owner mới được phân quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || member.role !== 'owner') {
      res.status(403).json({ message: 'Chỉ chủ nhóm mới có quyền phân quyền' });
      return;
    }

    if (!['admin', 'member'].includes(role)) {
      res.status(400).json({ message: 'Quyền không hợp lệ' });
      return;
    }

    await GroupMember.findOneAndUpdate(
      { groupID, userID: targetUserID },
      { role }
    );

    res.json({ message: 'Cập nhật quyền thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật quyền', error: error.message });
  }
});

// 9. Xóa nhóm (chỉ owner)
router.delete('/groups/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || member.role !== 'owner') {
      res.status(403).json({ message: 'Chỉ chủ nhóm mới có quyền xóa nhóm' });
      return;
    }

    await Group.findOneAndUpdate({ groupID }, { isActive: false });
    await GroupMember.updateMany({ groupID }, { isActive: false });

    res.json({ message: 'Xóa nhóm thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa nhóm', error: error.message });
  }
});

// ==================== GROUP MESSAGES ====================

// 10. Lấy tin nhắn của nhóm (pagination)
router.get('/groups/:groupID/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userID = req.userID;

    // Kiểm tra user có trong group không
    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập' });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await GroupMessage.find({
      groupID,
      deletedFor: { $ne: userID },
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Thêm senderInfo vào mỗi message
    const messagesWithSenderInfo = await Promise.all(
      messages.map(async (msg) => {
        const sender = await Users.findOne({ userID: msg.senderID });
        return {
          ...msg.toObject(),
          senderInfo: {
            name: sender?.name || 'Người dùng',
            avatar: sender?.anhDaiDien || null,
          },
        };
      })
    );

    const total = await GroupMessage.countDocuments({
      groupID,
      deletedFor: { $ne: userID },
    });

    res.json({
      messages: messagesWithSenderInfo.reverse(),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy tin nhắn', error: error.message });
  }
});

// 11. Ghim tin nhắn
router.post('/groups/:groupID/messages/:messageID/pin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, messageID } = req.params;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền ghim tin nhắn' });
      return;
    }

    await GroupMessage.findOneAndUpdate(
      { messageID, groupID },
      {
        pinnedInfo: {
          pinnedBy: userID,
          pinnedAt: new Date(),
        },
      }
    );

    res.json({ message: 'Ghim tin nhắn thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi ghim tin nhắn', error: error.message });
  }
});

// 12. Bỏ ghim tin nhắn
router.post('/groups/:groupID/messages/:messageID/unpin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, messageID } = req.params;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền bỏ ghim tin nhắn' });
      return;
    }

    await GroupMessage.findOneAndUpdate(
      { messageID, groupID },
      { pinnedInfo: null }
    );

    res.json({ message: 'Bỏ ghim tin nhắn thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi bỏ ghim tin nhắn', error: error.message });
  }
});

// 13. Tìm kiếm tin nhắn
router.get('/groups/:groupID/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { q, type } = req.query;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập' });
      return;
    }

    const query: any = { groupID, deletedFor: { $ne: userID } };

    if (q) {
      query.content = { $regex: q, $options: 'i' };
    }

    if (type) {
      query.type = type;
    }

    const messages = await GroupMessage.find(query).sort({ timestamp: -1 }).limit(100);

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tìm kiếm', error: error.message });
  }
});

export default router;
