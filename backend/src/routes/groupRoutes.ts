import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Group from '../models/Group';
import GroupMember from '../models/GroupMember';
import GroupMessage from '../models/GroupMessage';
import GroupJoinRequest from '../models/GroupJoinRequest';
import Users from '../models/User';
import GroupNote from '../models/GroupNote';
import Poll from '../models/Poll';

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

    // Default avatar: dùng DiceBear API tạo ảnh nhóm nếu user không chọn
    const defaultGroupAvatar = `https://api.dicebear.com/7.x/shapes/png?seed=${groupID}&size=200`;

    // Tạo group
    const group = new Group({
      groupID,
      name,
      description,
      avatar: avatar || defaultGroupAvatar,
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

    // Lấy thông tin owner để gửi notification
    const owner = await Users.findOne({ userID });
    const ownerName = owner?.name || 'Người dùng';

    // Emit socket event để notify tất cả members về nhóm mới
    const io = req.app.get('io');
    if (io) {
      // Emit đến từng member (bao gồm owner)
      const allMemberIDs = [userID, ...(memberIDs || [])];
      allMemberIDs.forEach((memberID) => {
        io.to(memberID).emit('new_group_created', {
          groupID,
          name,
          avatar,
          ownerID: userID,
          ownerName,
          memberCount: totalMembers,
          createdAt: new Date(),
        });
      });

      console.log(`✅ [CREATE GROUP] Emitted new_group_created to ${allMemberIDs.length} members`);
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

// ── JOIN VIA QR / INVITE LINK (phải đặt TRƯỚC /groups/:groupID để tránh conflict) ──

// Lấy thông tin group để hiển thị trước khi join (public info)
router.get('/groups/join-info/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID!;

    console.log(`🔍 [join-info] groupID=${groupID}, userID=${userID}`);

    const group = await Group.findOne({ groupID, isActive: true });
    console.log(`🔍 [join-info] group found:`, group ? `${group.name} (allowInviteLink=${group.settings.allowInviteLink})` : 'NOT FOUND');

    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại hoặc đã bị xóa' });
      return;
    }

    if (!group.settings.allowInviteLink) {
      res.status(403).json({ message: 'Nhóm này không cho phép tham gia qua link' });
      return;
    }

    const existingMember = await GroupMember.findOne({ groupID, userID, isActive: true });
    const memberCount = await GroupMember.countDocuments({ groupID, isActive: true });

    console.log(`🔍 [join-info] isAlreadyMember=${!!existingMember}, memberCount=${memberCount}`);

    res.json({
      groupID: group.groupID,
      name: group.name,
      avatar: group.avatar,
      description: group.description,
      memberCount,
      requireApproval: group.settings.requireApproval,
      allowInviteLink: group.settings.allowInviteLink,
      isAlreadyMember: !!existingMember,
    });
  } catch (err: any) {
    console.error(`❌ [join-info] error:`, err.message);
    res.status(500).json({ message: err.message });
  }
});

// Tham gia nhóm qua QR / invite link
router.post('/groups/join/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID!;

    const group = await Group.findOne({ groupID, isActive: true });
    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại hoặc đã bị xóa' });
      return;
    }

    if (!group.settings.allowInviteLink) {
      res.status(403).json({ message: 'Nhóm này không cho phép tham gia qua link' });
      return;
    }

    const existingMember = await GroupMember.findOne({ groupID, userID });
    if (existingMember?.isActive) {
      res.status(400).json({ message: 'Bạn đã là thành viên của nhóm này' });
      return;
    }

    if (group.blockedMembers.includes(userID)) {
      res.status(403).json({ message: 'Bạn đã bị chặn khỏi nhóm này' });
      return;
    }

    const user = await Users.findOne({ userID });
    if (!user) {
      res.status(404).json({ message: 'Người dùng không tồn tại' });
      return;
    }

    if (group.settings.requireApproval) {
      const existingRequest = await GroupJoinRequest.findOne({ groupID, userID, status: 'pending' });
      if (existingRequest) {
        res.status(400).json({ message: 'Bạn đã gửi yêu cầu tham gia, đang chờ duyệt' });
        return;
      }
      const requestID = `req_${uuidv4()}`;
      await GroupJoinRequest.create({ requestID, groupID, userID, requestedBy: userID, status: 'pending' });
      res.json({ message: 'Đã gửi yêu cầu tham gia nhóm, đang chờ admin duyệt', requireApproval: true });
      return;
    }

    if (existingMember) {
      existingMember.isActive = true;
      existingMember.leftAt = undefined;
      existingMember.role = 'member';
      await existingMember.save();
    } else {
      await GroupMember.create({ groupID, userID, role: 'member' });
    }

    // Gửi notification message
    const notifMsgID = `gmsg_notif_${uuidv4().substring(0, 8)}_${Date.now()}`;
    const notifMsg = await GroupMessage.create({
      messageID: notifMsgID,
      groupID,
      senderID: 'system',
      content: `${user.name} đã tham gia nhóm qua link mời`,
      type: 'notification',
      timestamp: new Date(),
    });

    // Emit real-time: thông báo cho tất cả thành viên trong group
    const io = req.app.get('io');
    if (io) {
      // 1. Broadcast notification message vào group chat
      io.to(groupID).emit('new_group_message', {
        ...notifMsg.toObject(),
        senderInfo: { name: 'Hệ thống', avatar: null },
      });

      // 2. Thông báo có thành viên mới (để web reload member list)
      io.to(groupID).emit('member_joined_group', {
        groupID,
        userID: user.userID,
        userName: user.name,
        avatar: user.anhDaiDien || null,
        joinedAt: new Date(),
      });

      // 3. Thêm user mới vào socket room của group
      // (user mobile sẽ tự join room khi reload chat list)
    }

    res.json({
      message: 'Tham gia nhóm thành công',
      requireApproval: false,
      group: { groupID: group.groupID, name: group.name, avatar: group.avatar },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
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

    console.log(`👥 [BACKEND] Group ${groupID} members (isActive=true):`, members.length);
    console.log(`   Members:`, members.map(m => `${m.userID} (${m.role}, active=${m.isActive})`).join(', '));

    res.json({
      ...group.toObject(),
      members,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết nhóm', error: error.message });
  }
});

// 4. Cập nhật settings nhóm (chỉ owner/admin)
router.put('/groups/:groupID/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { settings } = req.body;
    const userID = req.userID;

    console.log('📥 Received settings update:', { groupID, userID, settings });

    // Kiểm tra quyền (chỉ owner/admin)
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Chỉ trưởng nhóm và phó nhóm mới có quyền thay đổi cài đặt' });
      return;
    }

    // Lấy group hiện tại để merge settings
    const currentGroup = await Group.findOne({ groupID });
    if (!currentGroup) {
      res.status(404).json({ message: 'Nhóm không tồn tại' });
      return;
    }

    // Merge settings mới với settings cũ
    const mergedSettings = {
      ...currentGroup.settings,
      ...settings,
      memberPermissions: {
        ...(currentGroup.settings?.memberPermissions || {}),
        ...(settings.memberPermissions || {})
      }
    };

    console.log('💾 Saving merged settings:', mergedSettings);

    const group = await Group.findOneAndUpdate(
      { groupID },
      { settings: mergedSettings, updatedAt: new Date() },
      { new: true }
    );

    console.log('✅ Settings saved successfully');

    // Emit socket event để tất cả members reload settings
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('group_settings_updated', {
        groupID,
        settings: mergedSettings,
      });
    }

    // Nếu bật/tắt requireApproval → gửi notification vào chat
    const wasRequireApproval = currentGroup.settings?.requireApproval;
    const nowRequireApproval = mergedSettings.requireApproval;
    if (wasRequireApproval !== nowRequireApproval) {
      const changer = await Users.findOne({ userID });
      const content = nowRequireApproval
        ? `Hình thức tham gia nhóm được thay đổi thành "Cần phê duyệt"`
        : `Hình thức tham gia nhóm được thay đổi thành "Không cần phê duyệt"`;
      const notifID = `gmsg_${uuidv4()}`;
      const notif = new GroupMessage({
        messageID: notifID,
        groupID,
        senderID: userID,
        content,
        type: 'notification',
        timestamp: new Date(),
      });
      await notif.save();
      if (io) {
        io.to(groupID).emit('new_group_message', {
          ...notif.toObject(),
          senderInfo: { name: changer?.name || '' },
        });
      }
    }

    res.json({ message: 'Cập nhật cài đặt thành công', settings: group!.settings });
  } catch (error: any) {
    console.error('❌ Error updating settings:', error);
    res.status(500).json({ message: 'Lỗi cập nhật cài đặt', error: error.message });
  }
});

// 5. Cập nhật thông tin nhóm
router.put('/groups/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { name, description, avatar } = req.body;
    const userID = req.userID;

    // Lấy thông tin nhóm cũ
    const group = await Group.findOne({ groupID });
    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại' });
      return;
    }

    const oldName = group.name;
    const oldAvatar = group.avatar;

    // Lấy thông tin member
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa nhóm' });
      return;
    }

    // Kiểm tra quyền
    const isOwnerOrAdmin = ['owner', 'admin'].includes(member.role);
    
    // Nếu là member thường, kiểm tra setting
    if (!isOwnerOrAdmin) {
      const canChangeNameAvatar = group.settings?.memberPermissions?.changeNameAvatar ?? true;
      if (!canChangeNameAvatar) {
        res.status(403).json({ message: 'Bạn không có quyền thay đổi tên và ảnh đại diện nhóm' });
        return;
      }
    }

    const updatedGroup = await Group.findOneAndUpdate(
      { groupID },
      { name, description, avatar, updatedAt: new Date() },
      { new: true }
    );

    // Lấy thông tin người thay đổi
    const user = await Users.findOne({ userID });
    const userName = user?.name || 'Người dùng';

    // Tạo tin nhắn thông báo
    const GroupMessage = (await import('../models/GroupMessage')).default;
    const { v4: uuidv4 } = await import('uuid');

    let notificationContent = '';
    
    // Kiểm tra thay đổi gì
    const nameChanged = name && name !== oldName;
    const avatarChanged = avatar && avatar !== oldAvatar;

    if (nameChanged && avatarChanged) {
      notificationContent = `${userName} đã đổi tên nhóm thành "${name}" và cập nhật ảnh đại diện`;
    } else if (nameChanged) {
      notificationContent = `${userName} đã đổi tên nhóm thành "${name}"`;
    } else if (avatarChanged) {
      notificationContent = `${userName} đã cập nhật ảnh đại diện nhóm`;
    }

    // Chỉ tạo notification nếu có thay đổi
    if (notificationContent) {
      const messageID = `gmsg_${uuidv4()}`;
      const notificationMessage = new GroupMessage({
        messageID,
        groupID,
        senderID: userID,
        content: notificationContent,
        type: 'notification',
        timestamp: new Date(),
      });
      await notificationMessage.save();

      // Broadcast notification qua socket
      const io = req.app.get('io');
      if (io) {
        io.to(groupID).emit('new_group_message', {
          messageID,
          groupID,
          senderID: userID,
          content: notificationContent,
          type: 'notification',
          timestamp: new Date(),
          senderInfo: {
            name: userName,
            avatar: user?.anhDaiDien || null,
          },
        });

        // Emit event cập nhật thông tin nhóm để các client cập nhật real-time
        io.to(groupID).emit('group_info_updated', {
          groupID,
          name: updatedGroup?.name,
          avatar: updatedGroup?.avatar,
        });
      }
    }

    res.json({ message: 'Cập nhật nhóm thành công', group: updatedGroup });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật nhóm', error: error.message });
  }
});

// 6. Thêm thành viên vào nhóm
router.post('/groups/:groupID/members', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { userID: newUserID } = req.body;
    const userID = req.userID;

    // Kiểm tra quyền - ai cũng có thể thêm thành viên
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !member.isActive) {
      res.status(403).json({ message: 'Bạn không có quyền thêm thành viên' });
      return;
    }

    // Kiểm tra user mới có tồn tại không
    const newUser = await Users.findOne({ userID: newUserID });
    if (!newUser) {
      res.status(404).json({ message: 'Người dùng không tồn tại' });
      return;
    }

    // Kiểm tra user có bị chặn không
    const group = await Group.findOne({ groupID });
    if (group?.blockedMembers.includes(newUserID)) {
      // Chỉ owner/admin mới được thêm lại người bị chặn (và tự động bỏ chặn)
      if (!['owner', 'admin'].includes(member.role)) {
        res.status(403).json({
          message: 'Người này đã bị trưởng/phó nhóm chặn tham gia nhóm',
          errorCode: 'USER_BLOCKED',
        });
        return;
      }
      // owner/admin thêm lại → tự động bỏ chặn
      await Group.findOneAndUpdate(
        { groupID },
        { $pull: { blockedMembers: newUserID }, updatedAt: new Date() }
      );
    }

    // Kiểm tra user đã trong group chưa
    const existing = await GroupMember.findOne({ groupID, userID: newUserID });
    if (existing && existing.isActive) {
      res.status(400).json({ message: 'Người dùng đã trong nhóm' });
      return;
    }

    // Nếu requireApproval=true và người thêm là member thường → tạo join request
    const isAdminOrOwner = ['owner', 'admin'].includes(member.role);
    if (!isAdminOrOwner && group?.settings?.requireApproval) {
      // Kiểm tra đã có pending request chưa
      const existingRequest = await GroupJoinRequest.findOne({ groupID, userID: newUserID, status: 'pending' });
      if (existingRequest) {
        res.status(400).json({ message: 'Đã có yêu cầu tham gia đang chờ duyệt' });
        return;
      }
      const requestID = `gjr_${uuidv4()}`;
      await GroupJoinRequest.create({ requestID, groupID, userID: newUserID, requestedBy: userID });

      // Lấy tên người mời và người được mời
      const inviter = await Users.findOne({ userID });
      const invitee = await Users.findOne({ userID: newUserID });
      const inviterName = inviter?.name || 'Thành viên';
      const inviteeName = invitee?.name || 'Người dùng';

      // Lưu private notification chỉ owner/admin thấy
      const allMembers = await GroupMember.find({ groupID, isActive: true }).select('userID role');
      const adminOwnerIDs = allMembers.filter(m => ['owner', 'admin'].includes(m.role)).map(m => m.userID);
      const deletedFor = allMembers.map(m => m.userID).filter(id => !adminOwnerIDs.includes(id));

      const notifID = `gmsg_${uuidv4()}`;
      const notif = new GroupMessage({
        messageID: notifID,
        groupID,
        senderID: userID,
        // Format đặc biệt để frontend parse: JSON chứa requestID
        content: JSON.stringify({
          type: 'join_request_notification',
          requestID,
          inviteeName,
          inviterName,
        }),
        type: 'notification',
        deletedFor,
        timestamp: new Date(),
      });
      await notif.save();

      // Notify socket
      const io = req.app.get('io');
      if (io) {
        io.to(groupID).emit('new_join_request', { groupID, requestID, userID: newUserID, requestedBy: userID });
        // Emit notification tới groupID room, frontend tự filter theo role
        io.to(groupID).emit('new_join_request_notification', {
          groupID,
          message: {
            ...notif.toObject(),
            senderInfo: { name: inviterName },
          },
        });
      }
      res.json({ message: 'Đã gửi yêu cầu tham gia nhóm, chờ phê duyệt', requireApproval: true });
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

    // Lấy thông tin người thêm và người được thêm
    const adder = await Users.findOne({ userID });
    const added = await Users.findOne({ userID: newUserID });
    const adderName = adder?.name || 'Thành viên';
    const addedName = added?.name || 'Thành viên';

    // Tạo notification message
    const notifID = `gmsg_${uuidv4()}`;
    const notif = new GroupMessage({
      messageID: notifID,
      groupID,
      senderID: userID,
      content: `${adderName} đã thêm ${addedName} vào nhóm`,
      type: 'notification',
      timestamp: new Date(),
    });
    await notif.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Gửi notification message
      io.to(groupID).emit('new_group_message', {
        ...notif.toObject(),
        senderInfo: { name: adderName },
      });

      // Gửi event member_added để frontend refresh member list
      io.to(groupID).emit('member_added', {
        groupID,
        userID: newUserID,
        addedBy: userID,
        adderName,
        addedName,
      });

      // Emit đến personal room của user mới để họ nhận được nhóm mới
      io.to(newUserID).emit('added_to_group', {
        groupID,
        groupName: group?.name || '',
        addedBy: userID,
        adderName,
      });
    }

    res.json({ message: 'Thêm thành viên thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi thêm thành viên', error: error.message });
  }
});

// 7. Xóa thành viên khỏi nhóm
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

    // Admin chỉ có thể xóa member thường, không xóa được admin khác
    if (member.role === 'admin' && targetMember?.role === 'admin') {
      res.status(403).json({ message: 'Phó nhóm không thể xóa phó nhóm khác' });
      return;
    }

    await GroupMember.findOneAndUpdate(
      { groupID, userID: targetUserID },
      { isActive: false, leftAt: new Date() }
    );

    // ⭐ XÓA TẤT CẢ GROUP REMINDER CỦA USER BỊ KICK TRONG GROUP NÀY
    const GroupReminder = (await import('../models/GroupReminder')).default;
    
    // Xóa reminders mà user bị kick tạo ra
    const deletedCreated = await GroupReminder.deleteMany({ groupID, creatorID: targetUserID });
    
    // Remove user bị kick khỏi participants của các reminders khác
    await GroupReminder.updateMany(
      { groupID, 'participants.userID': targetUserID },
      { $pull: { participants: { userID: targetUserID } } }
    );
    
    console.log(`🗑️ User ${targetUserID} kicked from group ${groupID}: deleted ${deletedCreated.deletedCount} reminders and removed from all participant lists`);

    // Lấy thông tin người kick và người bị kick
    const kicker = await Users.findOne({ userID });
    const kicked = await Users.findOne({ userID: targetUserID });
    const kickerName = kicker?.name || 'Quản trị viên';
    const kickedName = kicked?.name || 'Thành viên';

    // Tạo notification message
    const notifID = `gmsg_${uuidv4()}`;
    const notif = new GroupMessage({
      messageID: notifID,
      groupID,
      senderID: userID,
      content: `${kickerName} đã xóa ${kickedName} khỏi nhóm`,
      type: 'notification',
      timestamp: new Date(),
    });
    await notif.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      // Gửi notification message
      io.to(groupID).emit('new_group_message', {
        ...notif.toObject(),
        senderInfo: { name: kickerName },
      });

      // Gửi event member_kicked
      io.to(groupID).emit('member_kicked', {
        groupID,
        kickedUserID: targetUserID,
        kickedBy: userID,
        kickerName,
        kickedName,
      });

      // Emit đến personal room của user bị kick (vì có thể đã rời group room)
      io.to(targetUserID).emit('member_kicked', {
        groupID,
        kickedUserID: targetUserID,
        kickedBy: userID,
        kickerName,
        kickedName,
      });
    }

    res.json({ message: 'Xóa thành viên thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa thành viên', error: error.message });
  }
});

// 8. Rời nhóm
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

    // ⭐ XÓA TẤT CẢ GROUP REMINDER CỦA USER TRONG GROUP NÀY
    const GroupReminder = (await import('../models/GroupReminder')).default;
    
    // Xóa reminders mà user tạo ra
    const deletedCreated = await GroupReminder.deleteMany({ groupID, creatorID: userID });
    
    // Remove user khỏi participants của các reminders khác
    await GroupReminder.updateMany(
      { groupID, 'participants.userID': userID },
      { $pull: { participants: { userID } } }
    );
    
    console.log(`🗑️ User ${userID} left group ${groupID}: deleted ${deletedCreated.deletedCount} reminders and removed from all participant lists`);

    // Lấy thông tin người rời nhóm
    const user = await Users.findOne({ userID });
    const userName = user?.name || 'Thành viên';

    // Tạo notification message
    const notifID = `gmsg_${uuidv4()}`;
    const notif = new GroupMessage({
      messageID: notifID,
      groupID,
      senderID: userID,
      content: `${userName} đã rời khỏi nhóm`,
      type: 'notification',
      timestamp: new Date(),
    });
    await notif.save();

    // Emit socket event để notify tất cả members
    const io = req.app.get('io');
    if (io) {
      console.log(`🔔 [BACKEND] Emitting member_left event to group ${groupID}:`, { userID, userName });
      
      // Gửi notification message
      io.to(groupID).emit('new_group_message', {
        ...notif.toObject(),
        senderInfo: { name: userName },
      });

      // Gửi event member_left để frontend xử lý
      io.to(groupID).emit('member_left', {
        groupID,
        userID,
        userName,
      });
      
      console.log(`✅ [BACKEND] member_left event emitted successfully`);
    } else {
      console.error('❌ [BACKEND] Socket.io instance not found!');
    }

    res.json({ message: 'Rời nhóm thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi rời nhóm', error: error.message });
  }
});

// 9. Phân quyền thành viên
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

    if (!['owner', 'admin', 'member'].includes(role)) {
      res.status(400).json({ message: 'Quyền không hợp lệ' });
      return;
    }

    // Nếu chuyển quyền owner → hạ owner hiện tại xuống admin
    if (role === 'owner') {
      await GroupMember.findOneAndUpdate({ groupID, userID }, { role: 'admin' });
      await Group.findOneAndUpdate({ groupID }, { ownerID: targetUserID, updatedAt: new Date() });
    }

    await GroupMember.findOneAndUpdate(
      { groupID, userID: targetUserID },
      { role }
    );

    // Gửi notification vào chat
    const actor = await Users.findOne({ userID });
    const target = await Users.findOne({ userID: targetUserID });
    const actorName = actor?.name || 'Quản trị viên';
    const targetName = target?.name || 'thành viên';

    let notifContent = '';
    if (role === 'owner') {
      notifContent = `${actorName} đã chuyển quyền trưởng nhóm cho ${targetName}`;
    } else if (role === 'admin') {
      notifContent = `${targetName} đã được thêm làm phó nhóm`;
    } else if (role === 'member') {
      notifContent = `${targetName} đã bị gỡ quyền phó nhóm`;
    }

    if (notifContent) {
      const notifID = `gmsg_${uuidv4()}`;
      const notif = new GroupMessage({
        messageID: notifID,
        groupID,
        senderID: userID,
        content: notifContent,
        type: 'notification',
        timestamp: new Date(),
      });
      await notif.save();
      const io = req.app.get('io');
      if (io) {
        io.to(groupID).emit('new_group_message', {
          ...notif.toObject(),
          senderInfo: { name: actorName },
        });
        // Emit role change event for real-time UI update
        io.to(groupID).emit('member_role_changed', {
          groupID,
          userID: targetUserID,
          newRole: role,
          changedBy: userID,
        });
      }
    }

    res.json({ message: 'Cập nhật quyền thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật quyền', error: error.message });
  }
});

// 9.5. Xóa lịch sử trò chuyện nhóm (chỉ ẩn messages cho user hiện tại)
router.delete('/groups/:groupID/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID!;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không trong nhóm này' });
      return;
    }

    // Set historyDeletedAt cho member này để ẩn messages cũ
    member.historyDeletedAt = new Date();
    await member.save();

    // ⭐ XÓA TẤT CẢ GROUP REMINDER CỦA USER TRONG GROUP NÀY
    // Có 2 loại: 
    // 1. Reminder mà user là creator
    // 2. Reminder mà user là participant
    const GroupReminder = (await import('../models/GroupReminder')).default;
    
    // Xóa reminders mà user tạo ra
    const deletedCreated = await GroupReminder.deleteMany({ groupID, creatorID: userID });
    
    // Xóa reminders mà user là participant (remove khỏi participants array)
    await GroupReminder.updateMany(
      { groupID, 'participants.userID': userID },
      { $pull: { participants: { userID } } }
    );
    
    console.log(`🗑️ User ${userID} deleted ${deletedCreated.deletedCount} group reminders (as creator) and removed from all participant lists in group ${groupID}`);

    console.log(`User ${userID} deleted history for group ${groupID}`);

    res.json({ success: true, message: 'Đã xóa lịch sử trò chuyện nhóm' });
  } catch (error: any) {
    console.error('Delete group history error:', error);
    res.status(500).json({ message: 'Lỗi xóa lịch sử', error: error.message });
  }
});

// 9.6. Ẩn group khỏi danh sách của user (chỉ ẩn, không xóa dữ liệu) - ⭐ PHẢI TRƯỚC DELETE /:groupID!
router.delete('/groups/:groupID/leave', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    // Kiểm tra user có trong group không
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // ✅ Idempotent: nếu đã ẩn rồi thì trả success luôn, không cần update lại
    if (!member.isActive && member.deletedAt) {
      return res.json({ success: true, deletedAt: member.deletedAt.toISOString() });
    }

    // ✅ Set deletedAt + isActive: false để ẩn group khỏi danh sách
    const result = await GroupMember.updateOne(
      { groupID, userID },
      { $set: { deletedAt: new Date(), isActive: false } }  // ⭐ Thêm isActive: false
    );

    console.log(`Hide group ${groupID} for user ${userID}:`, result);

    res.json({ success: true, deletedAt: new Date().toISOString() });
  } catch (e: any) {
    console.error('Hide group error:', e);
    res.status(500).json({ message: e.message });
  }
});

// 10. Xóa nhóm (chỉ owner)
router.delete('/groups/:groupID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || member.role !== 'owner') {
      res.status(403).json({ message: 'Chỉ chủ nhóm mới có quyền xóa nhóm' });
      return;
    }

    // Get all members before deleting
    const allMembers = await GroupMember.find({ groupID, isActive: true });
    const memberIDs = allMembers.map(m => m.userID);

    // Soft delete group and members
    await Group.findOneAndUpdate({ groupID }, { isActive: false, updatedAt: new Date() });
    await GroupMember.updateMany({ groupID }, { isActive: false, leftAt: new Date() });

    // Emit socket event to all members
    const io = req.app.get('io');
    if (io) {
      // Emit to group room (for members currently in the group chat)
      io.to(groupID).emit('group_dissolved', { 
        groupID,
        message: 'Nhóm đã bị giải tán bởi trưởng nhóm'
      });
      
      // Also emit to each member's personal room (for members not currently in chat)
      memberIDs.forEach(memberID => {
        io.to(memberID).emit('group_dissolved', { 
          groupID,
          message: 'Nhóm đã bị giải tán bởi trưởng nhóm'
        });
      });
    }

    res.json({ message: 'Xóa nhóm thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa nhóm', error: error.message });
  }
});

// ==================== GROUP MESSAGES ====================

// 11. Lấy tin nhắn của nhóm (pagination)
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

    // Nếu allowNewMembersReadHistory = false → chỉ lấy tin nhắn từ sau khi user join
    const group = await Group.findOne({ groupID });
    const timeFilter: Record<string, unknown> = {};
    if (!group?.settings?.allowNewMembersReadHistory) {
      timeFilter.timestamp = { $gte: member.joinedAt };
    }

    // Nếu user đã xóa lịch sử → chỉ lấy tin nhắn sau thời điểm xóa
    if (member.historyDeletedAt) {
      timeFilter.timestamp = { $gt: member.historyDeletedAt };
    }

    const messages = await GroupMessage.find({
      groupID,
      deletedFor: { $ne: userID },
      ...timeFilter,
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
      ...timeFilter,
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

// 12. Ghim tin nhắn
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

    const updated = await GroupMessage.findOneAndUpdate(
      { messageID, groupID },
      {
        pinnedInfo: {
          pinnedBy: userID,
          pinnedAt: new Date(),
        },
      },
      { new: true }
    );

    const user = await Users.findOne({ userID });
    const io = req.app.get('io');
    if (io && updated) {
      io.to(groupID).emit('ghim_group_notification', {
        ...updated.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null }
      });
    }

    res.json({ message: 'Ghim tin nhắn thành công', messageData: updated });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi ghim tin nhắn', error: error.message });
  }
});

// 13. Bỏ ghim tin nhắn
router.post('/groups/:groupID/messages/:messageID/unpin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, messageID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Bạn không có quyền bỏ ghim tin nhắn' });
      return;
    }

    const updated = await GroupMessage.findOneAndUpdate(
      { messageID, groupID },
      { pinnedInfo: null },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('unghim_group_notification', { messageID });
    }

    res.json({ message: 'Bỏ ghim tin nhắn thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi bỏ ghim tin nhắn', error: error.message });
  }
});

// 13.5. Lấy danh sách tin nhắn đã ghim
router.get('/groups/:groupID/pinned-messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    // Kiểm tra member
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    // Lấy tất cả tin nhắn đã ghim
    const pinnedMessages = await GroupMessage.find({
      groupID,
      'pinnedInfo.pinnedBy': { $exists: true, $ne: null }
    }).sort({ 'pinnedInfo.pinnedAt': -1 });

    // Lấy thông tin người gửi cho mỗi tin nhắn
    const messagesWithSenderInfo = await Promise.all(
      pinnedMessages.map(async (msg) => {
        try {
          const sender = await Users.findOne({ userID: msg.senderID });
          return {
            ...msg.toObject(),
            senderInfo: sender ? {
              name: sender.name,
              avatar: sender.anhDaiDien
            } : null
          };
        } catch {
          return {
            ...msg.toObject(),
            senderInfo: null
          };
        }
      })
    );

    res.json({ pinnedMessages: messagesWithSenderInfo });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy tin nhắn ghim', error: error.message });
  }
});

// 14. Tìm kiếm tin nhắn
router.get('/groups/:groupID/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { q, type, senderID, fromDate, toDate } = req.query as Record<string, string>;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập' });
      return;
    }

    const query: any = { groupID, deletedFor: { $ne: userID }, type: { $in: ['text', 'emoji'] } };

    if (q?.trim()) {
      query.content = { $regex: q.trim(), $options: 'i' };
    }

    if (type) {
      query.type = type;
    }

    if (senderID) {
      query.senderID = senderID;
    }

    if (fromDate || toDate) {
      query.timestamp = {};
      if (fromDate) query.timestamp.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const messages = await GroupMessage.find(query).sort({ timestamp: -1 }).limit(100).lean();

    // Enrich với senderInfo
    const senderIDs = [...new Set(messages.map((m) => m.senderID))];
    const senders = await Users.find({ userID: { $in: senderIDs } }).lean();
    const result = messages.map((m) => {
      const s = senders.find((u) => u.userID === m.senderID);
      return { ...m, senderInfo: s ? { name: s.name, avatar: s.anhDaiDien || null } : { name: m.senderID, avatar: null } };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tìm kiếm', error: error.message });
  }
});

// 15. Lấy settings nhóm
router.get('/groups/:groupID/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

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

    res.json({ settings: group.settings });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy cài đặt nhóm', error: error.message });
  }
});

// 16. Chặn thành viên khỏi nhóm
router.post('/groups/:groupID/block/:targetUserID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const groupID = req.params.groupID as string;
    const targetUserID = req.params.targetUserID as string;
    const userID = req.userID;

    // Chỉ owner/admin mới được chặn
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Chỉ trưởng nhóm và phó nhóm mới có quyền chặn thành viên' });
      return;
    }

    // Không cho chặn owner
    const targetMember = await GroupMember.findOne({ groupID, userID: targetUserID });
    if (targetMember?.role === 'owner') {
      res.status(400).json({ message: 'Không thể chặn trưởng nhóm' });
      return;
    }

    // Admin không được chặn admin khác
    if (member.role === 'admin' && targetMember?.role === 'admin') {
      res.status(403).json({ message: 'Phó nhóm không thể chặn phó nhóm khác' });
      return;
    }

    const group = await Group.findOne({ groupID });
    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại' });
      return;
    }

    if (group.blockedMembers.includes(targetUserID)) {
      res.status(400).json({ message: 'Thành viên này đã bị chặn' });
      return;
    }

    // Kick khỏi nhóm và thêm vào blockedMembers
    await GroupMember.findOneAndUpdate(
      { groupID, userID: targetUserID },
      { isActive: false, leftAt: new Date() }
    );

    await Group.findOneAndUpdate(
      { groupID },
      { $push: { blockedMembers: targetUserID }, updatedAt: new Date() }
    );

    // Broadcast socket notification
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('member_blocked', { groupID, userID: targetUserID });
    }

    res.json({ message: 'Đã chặn thành viên khỏi nhóm' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi chặn thành viên', error: error.message });
  }
});

// 17. Bỏ chặn thành viên
router.post('/groups/:groupID/unblock/:targetUserID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const groupID = req.params.groupID as string;
    const targetUserID = req.params.targetUserID as string;
    const userID = req.userID;

    // Chỉ owner/admin mới được bỏ chặn
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Chỉ trưởng nhóm và phó nhóm mới có quyền bỏ chặn' });
      return;
    }

    const group = await Group.findOne({ groupID });
    if (!group) {
      res.status(404).json({ message: 'Nhóm không tồn tại' });
      return;
    }

    if (!group.blockedMembers.includes(targetUserID)) {
      res.status(400).json({ message: 'Thành viên này không bị chặn' });
      return;
    }

    await Group.findOneAndUpdate(
      { groupID },
      { $pull: { blockedMembers: targetUserID }, updatedAt: new Date() }
    );

    res.json({ message: 'Đã bỏ chặn thành viên' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi bỏ chặn thành viên', error: error.message });
  }
});

// 18. Lấy danh sách join requests (chỉ owner/admin)
router.get('/groups/:groupID/join-requests', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Không có quyền xem yêu cầu tham gia' });
      return;
    }

    const requests = await GroupJoinRequest.find({ groupID, status: 'pending' });

    // Enrich với user info
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const [user, requester] = await Promise.all([
          Users.findOne({ userID: r.userID }),
          Users.findOne({ userID: r.requestedBy }),
        ]);
        return {
          requestID: r.requestID,
          userID: r.userID,
          name: user?.name || r.userID,
          avatar: user?.anhDaiDien,
          requestedBy: r.requestedBy,
          requestedByName: requester?.name || r.requestedBy,
          createdAt: r.createdAt,
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy yêu cầu tham gia', error: error.message });
  }
});

// 19. Đồng ý yêu cầu tham gia
router.post('/groups/:groupID/join-requests/:requestID/approve', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, requestID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Không có quyền phê duyệt' });
      return;
    }

    const request = await GroupJoinRequest.findOne({ requestID, groupID, status: 'pending' });
    if (!request) {
      res.status(404).json({ message: 'Yêu cầu không tồn tại' });
      return;
    }

    // Thêm vào nhóm
    const existing = await GroupMember.findOne({ groupID, userID: request.userID });
    if (existing) {
      existing.isActive = true;
      existing.leftAt = undefined;
      await existing.save();
    } else {
      await GroupMember.create({ groupID, userID: request.userID, role: 'member' });
    }

    await GroupJoinRequest.findOneAndUpdate({ requestID }, { status: 'approved' });

    // Notification vào chat
    const approver = await Users.findOne({ userID });
    const newUser = await Users.findOne({ userID: request.userID });
    const notifID = `gmsg_${uuidv4()}`;
    const notif = new GroupMessage({
      messageID: notifID,
      groupID,
      senderID: userID,
      content: `${approver?.name || 'Quản trị viên'} đã thêm ${newUser?.name || 'thành viên'} vào nhóm`,
      type: 'notification',
      timestamp: new Date(),
    });
    await notif.save();

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('new_group_message', { ...notif.toObject(), senderInfo: { name: approver?.name || '' } });
      io.to(groupID).emit('join_request_resolved', { requestID, groupID, status: 'approved' });
      // Emit member_added event để frontend refresh member list
      io.to(groupID).emit('member_added', {
        groupID,
        userID: request.userID,
        addedBy: userID,
        adderName: approver?.name || 'Quản trị viên',
        addedName: newUser?.name || 'Thành viên',
      });
    }

    res.json({ message: 'Đã đồng ý yêu cầu tham gia' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi phê duyệt', error: error.message });
  }
});

// 20. Từ chối yêu cầu tham gia
router.post('/groups/:groupID/join-requests/:requestID/reject', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, requestID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      res.status(403).json({ message: 'Không có quyền từ chối' });
      return;
    }

    const request = await GroupJoinRequest.findOne({ requestID, groupID, status: 'pending' });
    if (!request) {
      res.status(404).json({ message: 'Yêu cầu không tồn tại' });
      return;
    }

    await GroupJoinRequest.findOneAndUpdate({ requestID }, { status: 'rejected' });

    // Lưu notification vào chat
    const rejecter = await Users.findOne({ userID });
    const invitee = await Users.findOne({ userID: request.userID });
    const notifID = `gmsg_${uuidv4()}`;
    const notif = new GroupMessage({
      messageID: notifID,
      groupID,
      senderID: userID,
      content: `${rejecter?.name || 'Quản trị viên'} đã từ chối yêu cầu tham gia của ${invitee?.name || 'thành viên'}`,
      type: 'notification',
      timestamp: new Date(),
    });
    await notif.save();

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('join_request_resolved', { requestID, groupID, status: 'rejected' });
      io.to(groupID).emit('new_group_message', {
        ...notif.toObject(),
        senderInfo: { name: rejecter?.name || '' },
      });
    }

    res.json({ message: 'Đã từ chối yêu cầu tham gia' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi từ chối', error: error.message });
  }
});

// 21. Lưu private notification (chỉ người gửi thấy)
router.post('/groups/:groupID/private-notification', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { content } = req.body;
    const userID = req.userID;

    // Lấy tất cả thành viên trong nhóm
    const allMembers = await GroupMember.find({ groupID, isActive: true }).select('userID');
    // deletedFor = tất cả trừ người gửi
    const deletedFor = allMembers.map((m) => m.userID).filter((id) => id !== userID);

    const messageID = `gmsg_${uuidv4()}`;
    const msg = new GroupMessage({
      messageID,
      groupID,
      senderID: userID,
      content,
      type: 'notification',
      media_url: [],
      deletedFor,
      timestamp: new Date(),
    });
    await msg.save();

    res.json({ message: 'OK', messageID });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lưu thông báo', error: error.message });
  }
});

// ============= GROUP NOTES API =============

// Tạo ghi chú mới
router.post('/groups/:groupID/notes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { content } = req.body;
    const userID = req.userID;

    // Kiểm tra member
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const noteID = `note_${uuidv4()}`;
    const newNote = new GroupNote({
      noteID,
      groupID,
      creatorID: userID,
      content,
      isPinned: false,
    });

    await newNote.save();

    // Lấy thông tin creator
    const creator = await Users.findOne({ userID });
    const noteWithCreator = {
      ...newNote.toObject(),
      creatorInfo: creator ? {
        name: creator.name,
        avatar: creator.anhDaiDien
      } : null
    };

    // Tạo notification message (purple bubble)
    const notifMessageID = `gmsg_${uuidv4()}`;
    const contentPreview = content.length > 50 ? content.substring(0, 50) + '...' : content;
    const notificationMsg = new GroupMessage({
      messageID: notifMessageID,
      groupID,
      senderID: userID,
      content: `${creator?.name || 'Người dùng'} đã tạo ghi chú: "${contentPreview}"`,
      type: 'notification',
      timestamp: new Date(),
      media_url: [],
      status: 'sent',
    });
    await notificationMsg.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Emit note created event
      io.to(groupID).emit('note_created', noteWithCreator);
      
      // Emit notification message
      io.to(groupID).emit('new_group_message', {
        ...notificationMsg.toObject(),
        senderInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
      });
    }

    res.status(201).json({ note: noteWithCreator });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tạo ghi chú', error: error.message });
  }
});

// Lấy danh sách ghi chú
router.get('/groups/:groupID/notes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    // Kiểm tra member
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const notes = await GroupNote.find({ groupID }).sort({ isPinned: -1, createdAt: -1 });

    // Lấy thông tin creator cho mỗi note
    const notesWithCreator = await Promise.all(
      notes.map(async (note) => {
        try {
          const creator = await Users.findOne({ userID: note.creatorID });
          return {
            ...note.toObject(),
            creatorInfo: creator ? {
              name: creator.name,
              avatar: creator.anhDaiDien
            } : null
          };
        } catch {
          return {
            ...note.toObject(),
            creatorInfo: null
          };
        }
      })
    );

    res.json({ notes: notesWithCreator });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy danh sách ghi chú', error: error.message });
  }
});

// Cập nhật ghi chú
router.put('/groups/:groupID/notes/:noteID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const { content } = req.body;
    const userID = req.userID;

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Không tìm thấy ghi chú' });
      return;
    }

    // Chỉ creator mới được sửa
    if (note.creatorID !== userID) {
      res.status(403).json({ message: 'Bạn không có quyền sửa ghi chú này' });
      return;
    }

    note.content = content;
    await note.save();

    // Lấy thông tin creator
    const creator = await Users.findOne({ userID: note.creatorID });
    const noteWithCreator = {
      ...note.toObject(),
      creatorInfo: creator ? {
        name: creator.name,
        avatar: creator.anhDaiDien
      } : null
    };

    // Tạo notification message (purple bubble)
    const notifMessageID = `gmsg_${uuidv4()}`;
    const contentPreview = content.length > 50 ? content.substring(0, 50) + '...' : content;
    const notificationMsg = new GroupMessage({
      messageID: notifMessageID,
      groupID,
      senderID: userID,
      content: `${creator?.name || 'Người dùng'} đã chỉnh sửa ghi chú: "${contentPreview}"`,
      type: 'notification',
      timestamp: new Date(),
      media_url: [],
      status: 'sent',
    });
    await notificationMsg.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Emit note updated event
      io.to(groupID).emit('note_updated', noteWithCreator);
      
      // Emit notification message
      io.to(groupID).emit('new_group_message', {
        ...notificationMsg.toObject(),
        senderInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
      });
    }

    res.json({ note: noteWithCreator });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật ghi chú', error: error.message });
  }
});

// Xóa ghi chú
router.delete('/groups/:groupID/notes/:noteID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const userID = req.userID;

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Không tìm thấy ghi chú' });
      return;
    }

    // Chỉ creator hoặc admin/owner mới được xóa
    const member = await GroupMember.findOne({ groupID, userID });
    if (note.creatorID !== userID && !['owner', 'admin'].includes(member?.role || '')) {
      res.status(403).json({ message: 'Bạn không có quyền xóa ghi chú này' });
      return;
    }

    await GroupNote.deleteOne({ noteID, groupID });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_deleted', { noteID, groupID });
    }

    res.json({ message: 'Xóa ghi chú thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa ghi chú', error: error.message });
  }
});

// Ghim/bỏ ghim ghi chú
router.post('/groups/:groupID/notes/:noteID/toggle-pin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const userID = req.userID;

    // Kiểm tra quyền
    const member = await GroupMember.findOne({ groupID, userID });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Không tìm thấy ghi chú' });
      return;
    }

    // Toggle pin
    const wasPinned = note.isPinned;
    note.isPinned = !note.isPinned;
    note.pinnedAt = note.isPinned ? new Date() : undefined;
    await note.save();

    // Lấy thông tin creator và user
    const creator = await Users.findOne({ userID: note.creatorID });
    const user = await Users.findOne({ userID });
    const noteWithCreator = {
      ...note.toObject(),
      creatorInfo: creator ? {
        name: creator.name,
        avatar: creator.anhDaiDien
      } : null
    };

    // Tạo notification message (purple bubble) khi ghim
    if (note.isPinned) {
      const notifMessageID = `gmsg_${uuidv4()}`;
      const contentPreview = note.content.length > 50 ? note.content.substring(0, 50) + '...' : note.content;
      const notificationMsg = new GroupMessage({
        messageID: notifMessageID,
        groupID,
        senderID: userID,
        content: `${user?.name || 'Người dùng'} đã ghim ghi chú: "${contentPreview}"`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await notificationMsg.save();

      // Emit notification message
      const io = req.app.get('io');
      if (io) {
        io.to(groupID).emit('new_group_message', {
          ...notificationMsg.toObject(),
          senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
        });
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_pin_toggled', noteWithCreator);
    }

    res.json({ note: noteWithCreator });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi ghim/bỏ ghim ghi chú', error: error.message });
  }
});

// 17. Lấy danh sách nhóm chung giữa 2 user
router.get('/groups/mutual/:targetUserID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userID = req.userID;
    const { targetUserID } = req.params;

    if (!targetUserID) {
      res.status(400).json({ message: 'TargetUserID là bắt buộc' });
      return;
    }

    // Lấy danh sách groupID của user hiện tại
    const user1Groups = await GroupMember.find({ userID, isActive: true }).select('groupID');
    const user1GroupIDs = user1Groups.map(m => m.groupID);

    // Lấy danh sách groupID của user mục tiêu nằm trong tập groupID của user hiện tại
    const mutualMembers = await GroupMember.find({
      userID: targetUserID,
      groupID: { $in: user1GroupIDs },
      isActive: true
    }).select('groupID');
    
    const mutualGroupIDs = mutualMembers.map(m => m.groupID);

    // Fetch thông tin chi tiết các group chung
    const mutualGroups = await Group.find({
      groupID: { $in: mutualGroupIDs },
      isActive: true
    }).select('groupID name avatar description').lean();

    res.json(mutualGroups);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy nhóm chung', error: error.message });
  }
});

// ==================== POLLS (Bình chọn) ====================

// Tạo bình chọn mới
router.post('/groups/:groupID/polls', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    // Kiểm tra thành viên
    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    // Kiểm tra quyền tạo poll
    const isOwnerOrAdmin = ['owner', 'admin'].includes(member.role);
    if (!isOwnerOrAdmin) {
      const group = await Group.findOne({ groupID });
      const canCreatePolls = group?.settings?.memberPermissions?.createPolls ?? true;
      if (!canCreatePolls) {
        res.status(403).json({ message: 'Bạn không có quyền tạo bình chọn trong nhóm này' });
        return;
      }
    }

    const { question, options, isMultipleChoice, endTime, canAddOptions, hideResultsBeforeVote, isAnonymous, shouldPin } = req.body;

    // Validate
    if (!question?.trim()) {
      res.status(400).json({ message: 'Câu hỏi không được để trống' });
      return;
    }
    if (!options || !Array.isArray(options) || options.length < 2) {
      res.status(400).json({ message: 'Cần ít nhất 2 lựa chọn' });
      return;
    }

    if (options.length > 30) {
      res.status(400).json({ message: 'Tối đa 30 lựa chọn' });
      return;
    }

    const pollID = `poll_${uuidv4()}`;
    const poll = new Poll({
      pollID,
      groupID,
      creatorID: userID,
      question: question.trim(),
      options: options.map((opt: string) => ({ text: opt.trim(), voters: [] })),
      isMultipleChoice: isMultipleChoice || false,
      endTime: endTime ? new Date(endTime) : undefined,
      canAddOptions: canAddOptions || false,
      hideResultsBeforeVote: hideResultsBeforeVote || false,
      isAnonymous: isAnonymous || false,
    });
    await poll.save();

    // Tạo tin nhắn poll trong chat
    const creator = await Users.findOne({ userID });
    const messageID = `gmsg_${uuidv4()}`;
    // Tạo tin nhắn thông báo "X đã tạo một bình chọn"
    const createNotifID = `gmsg_${uuidv4()}`;
    const pollNotif = new GroupMessage({
      messageID: createNotifID,
      groupID,
      senderID: userID,
      content: `POLL_NOTIF|CREATE|${pollID}|${poll.question}|${creator?.name || 'Người dùng'}`,
      type: 'notification',
      timestamp: new Date(),
      media_url: [],
      status: 'sent',
    });
    await pollNotif.save();

    const pollMessage = new GroupMessage({
      messageID,
      groupID,
      senderID: userID,
      content: question.trim(),
      type: 'poll',
      pollID,
      timestamp: new Date(Date.now() + 1000), // Thêm 1s để hiện sau thông báo
      media_url: [],
      status: 'sent',
      pinnedInfo: shouldPin ? {
        pinnedBy: userID,
        pinnedAt: new Date(),
      } : undefined,
    });
    await pollMessage.save();

    // Emit socket realtime cho tin nhắn mới
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
      });
      io.to(groupID).emit('new_group_message', {
        ...pollMessage.toObject(),
        senderInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
      });
    }

    // Lấy thông tin poll đầy đủ để trả về
    const pollData = {
      ...poll.toObject(),
      creatorInfo: {
        name: creator?.name || 'Người dùng',
        avatar: creator?.anhDaiDien || null,
      },
    };

    // Emit socket events
    const io_emit = req.app.get('io');
    if (io_emit) {
      // Thông báo poll mới
      io_emit.to(groupID).emit('poll_created', pollData);

      // [UPDATE] Gửi tin nhắn poll vào chat dưới dạng CARD (type: poll)
      io_emit.to(groupID).emit('new_group_message', {
        ...pollMessage.toObject(),
        senderInfo: {
          name: creator?.name || 'Người dùng',
          avatar: creator?.anhDaiDien || null,
        },
      });

      // [NEW] Gửi thêm một thông báo hệ thống về việc tạo bình chọn
      const pollNotifID = `gmsg_${uuidv4()}`;
      const pollNotif = new GroupMessage({
        messageID: pollNotifID,
        groupID,
        senderID: userID,
        content: `##POLL_CREATED##|${pollID}|${question.trim()}|${creator?.name || 'Ai đó'}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await pollNotif.save();

      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
      });
    }

    res.status(201).json({ message: 'Tạo bình chọn thành công', poll: pollData });
  } catch (error: any) {
    console.error('❌ Lỗi tạo bình chọn:', error);
    res.status(500).json({ message: 'Lỗi tạo bình chọn', error: error.message });
  }
});

// Lấy danh sách bình chọn của nhóm
router.get('/groups/:groupID/polls', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const polls = await Poll.find({ groupID, isActive: true }).sort({ createdAt: -1 });

    // Tối ưu: Lấy thông tin creator cho tất cả các poll trong 1 lần query
    const creatorIDs = [...new Set(polls.map(p => p.creatorID))];
    const creators = await Users.find({ userID: { $in: creatorIDs } });
    const creatorMap = creators.reduce((acc: any, user: any) => {
      acc[user.userID] = {
        name: user.name || 'Người dùng',
        avatar: user.anhDaiDien || null,
      };
      return acc;
    }, {});

    const enriched = polls.map((poll) => {
      const pollObj = poll.toObject();
      const creatorInfo = creatorMap[poll.creatorID] || { name: 'Người dùng', avatar: null };
      
      // Nếu ẩn danh, xóa thông tin voters khỏi options
      if (poll.isAnonymous) {
        pollObj.options = pollObj.options.map((opt: any) => ({
          ...opt,
          voters: opt.voters.map(() => 'hidden')
        }));
      }

      return {
        ...pollObj,
        creatorInfo,
      };
    });

    res.json({ polls: enriched });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy danh sách bình chọn', error: error.message });
  }
});

// Lấy chi tiết 1 bình chọn
router.get('/groups/:groupID/polls/:pollID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại' });
      return;
    }

    const creator = await Users.findOne({ userID: poll.creatorID });
    const pollObj = poll.toObject();

    // Nếu ẩn danh, ẩn thông tin voters
    if (poll.isAnonymous) {
      pollObj.options = pollObj.options.map((opt: any) => ({
        ...opt,
        voters: opt.voters.map(() => 'hidden')
      }));
    }

    res.json({
      ...pollObj,
      creatorInfo: {
        name: creator?.name || 'Người dùng',
        avatar: creator?.anhDaiDien || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết bình chọn', error: error.message });
  }
});

// Vote / Bỏ vote cho 1 option
router.post('/groups/:groupID/polls/:pollID/vote', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const { optionIndex } = req.body;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID, isActive: true });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại hoặc đã kết thúc' });
      return;
    }

    // Kiểm tra thời gian kết thúc
    if (poll.endTime && new Date() > poll.endTime) {
      res.status(400).json({ message: 'Bình chọn đã kết thúc' });
      return;
    }

    // Kiểm tra optionIndex hợp lệ
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      res.status(400).json({ message: 'Lựa chọn không hợp lệ' });
      return;
    }

    const option = poll.options[optionIndex];
    const currentUserID = userID as string;
    const alreadyVoted = option.voters.includes(currentUserID);

    if (alreadyVoted) {
      // Bỏ vote (toggle)
      option.voters = option.voters.filter(id => id !== currentUserID);
    } else {
      // Nếu không cho chọn nhiều → xóa vote cũ ở các option khác
      if (!poll.isMultipleChoice) {
        poll.options.forEach(opt => {
          opt.voters = opt.voters.filter(id => id !== currentUserID);
        });
      }
      // Thêm vote
      option.voters.push(currentUserID);
    }

    await poll.save();

    // Lấy creator info
    const creator = await Users.findOne({ userID: poll.creatorID });
    const updatedPoll = {
      ...poll.toObject(),
      creatorInfo: {
        name: creator?.name || 'Người dùng',
        avatar: creator?.anhDaiDien || null,
      },
    };

    // Emit socket realtime
    const io = req.app.get('io');
    if (io) {
      // Nếu ẩn danh, ẩn voters khi emit
      const pollForEmit = {
        ...updatedPoll,
        options: updatedPoll.options.map((opt: any) => ({
          ...opt,
          voters: poll.isAnonymous ? opt.voters.map(() => 'hidden') : opt.voters
        }))
      };
      io.to(groupID).emit('poll_updated', pollForEmit);
      io.to(groupID).emit('poll_voted', pollForEmit); // Mobile lắng nghe poll_voted

      // [NEW] Gửi thông báo hệ thống khi có người bình chọn (toggle)
      const user = await Users.findOne({ userID });
      const voteNotifID = `gmsg_${uuidv4()}`;
      
      let actionType = alreadyVoted ? 'LEAVE' : 'JOIN';
      
      // Kiểm tra nếu là đổi lựa chọn (đã vote ở option khác trước đó)
      if (!alreadyVoted && !poll.isMultipleChoice) {
        const otherVoted = poll.options.some((opt, idx) => idx !== optionIndex && opt.voters.includes(currentUserID));
        if (otherVoted) {
          actionType = 'CHANGE';
        }
      }

      const pollNotif = new GroupMessage({
        messageID: voteNotifID,
        groupID,
        senderID: userID,
        // Format: POLL_NOTIF|[actionType]|[pollID]|[pollQuestion]|[userName]
        content: `POLL_NOTIF|${actionType}|${pollID}|${poll.question}|${user?.name || 'Người dùng'}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await pollNotif.save();

      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    res.json({ message: alreadyVoted ? 'Đã bỏ bình chọn' : 'Đã bình chọn', poll: updatedPoll });
  } catch (error: any) {
    console.error('❌ Lỗi vote:', error);
    res.status(500).json({ message: 'Lỗi bình chọn', error: error.message });
  }
});

// Thêm phương án mới vào cuộc bình chọn
router.post('/groups/:groupID/polls/:pollID/add-option', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const { text } = req.body;
    const userID = req.userID;

    if (!text || !text.trim()) {
      res.status(400).json({ message: 'Vui lòng nhập nội dung phương án' });
      return;
    }

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền tham gia nhóm này' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID, isActive: true });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại hoặc đã kết thúc' });
      return;
    }

    if (!poll.canAddOptions) {
      res.status(403).json({ message: 'Cuộc bình chọn này không cho phép thêm phương án mới' });
      return;
    }

    if (poll.options.length >= 30) {
      res.status(400).json({ message: 'Đã đạt giới hạn tối đa 30 lựa chọn' });
      return;
    }

    // Kiểm tra trùng lặp
    const exists = poll.options.some(opt => opt.text.toLowerCase() === text.trim().toLowerCase());
    if (exists) {
      res.status(400).json({ message: 'Phương án này đã tồn tại' });
      return;
    }

    poll.options.push({ text: text.trim(), voters: [] });
    await poll.save();

    const creator = await Users.findOne({ userID: poll.creatorID });
    const updatedPoll = {
      ...poll.toObject(),
      creatorInfo: {
        name: creator?.name || 'Người dùng',
        avatar: creator?.anhDaiDien || null,
      },
    };

    const io = req.app.get('io');
    if (io) {
      const pollForEmit = {
        ...updatedPoll,
        options: updatedPoll.options.map((opt: any) => ({
          ...opt,
          voters: poll.isAnonymous ? opt.voters.map(() => 'hidden') : opt.voters
        }))
      };
      io.to(groupID).emit('poll_updated', pollForEmit);
      io.to(groupID).emit('poll_voted', pollForEmit); // Mobile lắng nghe poll_voted

      // [NEW] Gửi thông báo hệ thống khi thêm phương án mới
      const user = await Users.findOne({ userID });
      const addOptionNotifID = `gmsg_${uuidv4()}`;
      const pollNotif = new GroupMessage({
        messageID: addOptionNotifID,
        groupID,
        senderID: userID,
        content: `##POLL_OPTION_ADDED##|${pollID}|${poll.question}|${user?.name || 'Ai đó'}|${text.trim()}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await pollNotif.save();

      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    res.json({ message: 'Thêm phương án thành công', poll: updatedPoll });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi thêm phương án', error: error.message });
  }
});

// Xóa bình chọn (chỉ người tạo hoặc admin/owner)
router.delete('/groups/:groupID/polls/:pollID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại' });
      return;
    }

    // Chỉ người tạo hoặc admin/owner mới được xóa
    const isOwnerOrAdmin = ['owner', 'admin'].includes(member.role);
    if (poll.creatorID !== userID && !isOwnerOrAdmin) {
      res.status(403).json({ message: 'Bạn không có quyền xóa bình chọn này' });
      return;
    }

    // Soft delete
    poll.isActive = false;
    await poll.save();

    // Cập nhật tin nhắn poll trong chat thành notification
    await GroupMessage.findOneAndUpdate(
      { pollID, groupID },
      { type: 'notification', content: 'Bình chọn đã bị xóa', pollID: undefined }
    );

    // Emit socket
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('poll_deleted', { pollID, groupID });

      // [NEW] Gửi thông báo hệ thống về việc xóa bình chọn
      const user = await Users.findOne({ userID });
      const deleteNotifID = `gmsg_${uuidv4()}`;
      const pollNotif = new GroupMessage({
        messageID: deleteNotifID,
        groupID,
        senderID: userID,
        content: `##POLL_DELETED##|${pollID}|${poll.question}|${user?.name || 'Ai đó'}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await pollNotif.save();

      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    res.json({ message: 'Đã xóa bình chọn' });
  } catch (error: any) {
    console.error('❌ Lỗi xóa bình chọn:', error);
    res.status(500).json({ message: 'Lỗi xóa bình chọn', error: error.message });
  }
});

// Khóa bình chọn (Dừng nhận vote)
router.post('/groups/:groupID/polls/:pollID/lock', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID, isActive: true });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại hoặc đã bị đóng' });
      return;
    }

    // Bỏ qua kiểm tra quyền, cho phép mọi thành viên trong nhóm khóa bình chọn
    // (hoặc nếu vẫn muốn giữ lại quyền cho người tạo thì bỏ comment)
    // const isOwnerOrAdmin = ['owner', 'admin'].includes(member.role);
    // if (poll.creatorID !== userID && !isOwnerOrAdmin) {
    //   res.status(403).json({ message: 'Bạn không có quyền khóa bình chọn này' });
    //   return;
    // }

    // Khóa bằng cách set endTime về quá khứ hoặc dùng flag mới (ở đây ta set endTime nếu chưa có)
    if (!poll.endTime || poll.endTime > new Date()) {
      poll.endTime = new Date(); // Dừng ngay lập tức
    }
    // Ta cũng có thể thêm field isLocked vào model nếu muốn, nhưng hiện tại logic endTime đang được dùng để check
    await poll.save();

    const user = await Users.findOne({ userID });
    const creator = await Users.findOne({ userID: poll.creatorID });
    
    const updatedPoll = {
      ...poll.toObject(),
      creatorInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null }
    };

    // Emit socket
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('poll_updated', updatedPoll);
      io.to(groupID).emit('poll_voted', updatedPoll); // Mobile lắng nghe poll_voted

      // Gửi thông báo hệ thống khóa bình chọn
      const lockNotifID = `gmsg_${uuidv4()}`;
      const pollNotif = new GroupMessage({
        messageID: lockNotifID,
        groupID,
        senderID: userID,
        content: `POLL_NOTIF|LOCK|${pollID}|${poll.question}|${user?.name || 'Người dùng'}`,
        type: 'notification',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
      });
      await pollNotif.save();

      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    res.json({ message: 'Đã khóa bình chọn', poll: updatedPoll });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khóa bình chọn', error: error.message });
  }
});

// Gửi lại (share) bình chọn vào nhóm
router.post('/groups/:groupID/polls/:pollID/share', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại' });
      return;
    }

    const user = await Users.findOne({ userID });

    // Tạo tin nhắn thông báo "X đã chia sẻ cuộc bình chọn"
    const shareNotifID = `gmsg_${uuidv4()}`;
    const pollNotif = new GroupMessage({
      messageID: shareNotifID,
      groupID,
      senderID: userID,
      content: `POLL_NOTIF|SHARE|${pollID}|${poll.question}|${user?.name || 'Người dùng'}`,
      type: 'notification',
      timestamp: new Date(),
      media_url: [],
      status: 'sent',
    });
    await pollNotif.save();

    // Emit notification
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('new_group_message', {
        ...pollNotif.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    // Tạo tin nhắn poll
    const pollMessageID = `gmsg_${uuidv4()}`;
    const pollMessage = new GroupMessage({
      messageID: pollMessageID,
      groupID,
      senderID: userID,
      content: poll.question,
      type: 'poll',
      pollID,
      timestamp: new Date(Date.now() + 1000), // Thêm 1s để hiện sau thông báo
      media_url: [],
      status: 'sent',
    });
    await pollMessage.save();

    if (io) {
      io.to(groupID).emit('new_group_message', {
        ...pollMessage.toObject(),
        senderInfo: { name: user?.name || 'Người dùng', avatar: user?.anhDaiDien || null },
      });
    }

    res.json({ message: 'Đã chia sẻ bình chọn' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi chia sẻ bình chọn', error: error.message });
  }
});

// Ghim / bỏ ghim bình chọn
router.post('/groups/:groupID/polls/:pollID/toggle-pin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, pollID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không phải thành viên của nhóm' });
      return;
    }

    const poll = await Poll.findOne({ pollID, groupID });
    if (!poll) {
      res.status(404).json({ message: 'Bình chọn không tồn tại' });
      return;
    }

    poll.isPinned = !poll.isPinned;
    poll.pinnedAt = poll.isPinned ? new Date() : undefined;
    await poll.save();

    const creator = await Users.findOne({ userID: poll.creatorID });
    const pollObj = {
      ...poll.toObject(),
      creatorInfo: { name: creator?.name || 'Người dùng', avatar: creator?.anhDaiDien || null },
    };

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('poll_updated', pollObj);
      io.to(groupID).emit('poll_voted', pollObj); // Mobile lắng nghe poll_voted
    }

    res.json({ message: poll.isPinned ? 'Đã ghim bình chọn' : 'Đã bỏ ghim bình chọn', poll: pollObj });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi ghim/bỏ ghim bình chọn', error: error.message });
  }
});


// ==================== GROUP NOTES ====================

// Lấy danh sách ghi chú của nhóm
router.get('/groups/:groupID/notes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      return;
    }

    const notes = await GroupNote.find({ groupID }).sort({ isPinned: -1, createdAt: -1 });

    // Enrich với creator info
    const enriched = await Promise.all(
      notes.map(async (note) => {
        const creator = await Users.findOne({ userID: note.creatorID });
        return {
          ...note.toObject(),
          creatorInfo: {
            name: creator?.name || note.creatorID,
            avatar: creator?.anhDaiDien,
          },
        };
      })
    );

    res.json({ notes: enriched });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy ghi chú', error: error.message });
  }
});

// Tạo ghi chú mới
router.post('/groups/:groupID/notes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { content } = req.body;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      return;
    }

    // Kiểm tra quyền createNotes
    // Giống logic frontend: Owner HOẶC Admin luôn có quyền
    const isOwnerOrAdmin = ['owner', 'admin'].includes(member.role);
    if (!isOwnerOrAdmin) {
      const group = await Group.findOne({ groupID });
      const canCreateNotes = group?.settings?.memberPermissions?.createNotes ?? true;
      if (!canCreateNotes) {
        res.status(403).json({ message: 'Bạn không có quyền tạo ghi chú trong nhóm này' });
        return;
      }
    }

    if (!content?.trim()) {
      res.status(400).json({ message: 'Nội dung ghi chú không được để trống' });
      return;
    }

    const noteID = `note_${uuidv4()}`;
    const note = new GroupNote({
      noteID,
      groupID,
      creatorID: userID,
      content: content.trim(),
      isPinned: false,
    });
    await note.save();

    const creator = await Users.findOne({ userID });
    const noteObj = {
      ...note.toObject(),
      creatorInfo: { name: creator?.name || userID, avatar: creator?.anhDaiDien },
    };

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_created', noteObj);
    }

    res.status(201).json({ message: 'Tạo ghi chú thành công', note: noteObj });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tạo ghi chú', error: error.message });
  }
});

// Cập nhật ghi chú
router.put('/groups/:groupID/notes/:noteID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const { content } = req.body;
    const userID = req.userID;

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Ghi chú không tồn tại' });
      return;
    }

    const member = await GroupMember.findOne({ groupID, userID });
    const isOwnerOrAdmin = member && ['owner', 'admin'].includes(member.role);

    // Kiểm tra quyền createNotes (dùng chung cho cả tạo và sửa)
    if (!isOwnerOrAdmin) {
      const group = await Group.findOne({ groupID });
      const canCreateNotes = group?.settings?.memberPermissions?.createNotes ?? true;
      if (!canCreateNotes) {
        res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa ghi chú trong nhóm này' });
        return;
      }
    }

    if (note.creatorID !== userID && !isOwnerOrAdmin) {
      res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa ghi chú này' });
      return;
    }

    if (!content?.trim()) {
      res.status(400).json({ message: 'Nội dung ghi chú không được để trống' });
      return;
    }

    note.content = content.trim();
    await note.save();

    const creator = await Users.findOne({ userID });
    const noteObj = {
      ...note.toObject(),
      creatorInfo: { name: creator?.name || userID, avatar: creator?.anhDaiDien },
    };

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_updated', noteObj);
    }

    res.json({ message: 'Cập nhật ghi chú thành công', note: noteObj });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật ghi chú', error: error.message });
  }
});

// Xóa ghi chú
router.delete('/groups/:groupID/notes/:noteID', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const userID = req.userID;

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Ghi chú không tồn tại' });
      return;
    }

    // Chỉ người tạo hoặc owner/admin mới được xóa
    const member = await GroupMember.findOne({ groupID, userID });
    const isOwnerOrAdmin = member && ['owner', 'admin'].includes(member.role);
    if (note.creatorID !== userID && !isOwnerOrAdmin) {
      res.status(403).json({ message: 'Bạn không có quyền xóa ghi chú này' });
      return;
    }

    await GroupNote.deleteOne({ noteID });

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_deleted', { noteID, groupID });
    }

    res.json({ message: 'Xóa ghi chú thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa ghi chú', error: error.message });
  }
});

// Ghim / bỏ ghim ghi chú
router.post('/groups/:groupID/notes/:noteID/toggle-pin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID, noteID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      return;
    }

    const note = await GroupNote.findOne({ noteID, groupID });
    if (!note) {
      res.status(404).json({ message: 'Ghi chú không tồn tại' });
      return;
    }

    note.isPinned = !note.isPinned;
    note.pinnedAt = note.isPinned ? new Date() : undefined;
    await note.save();

    const creator = await Users.findOne({ userID: note.creatorID });
    const noteObj = {
      ...note.toObject(),
      creatorInfo: { name: creator?.name || note.creatorID, avatar: creator?.anhDaiDien },
    };

    const io = req.app.get('io');
    if (io) {
      io.to(groupID).emit('note_pin_toggled', noteObj);
    }

    res.json({ message: note.isPinned ? 'Đã ghim ghi chú' : 'Đã bỏ ghim ghi chú', note: noteObj });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi ghim/bỏ ghim ghi chú', error: error.message });
  }
});

// Lấy danh sách tin nhắn đã ghim
router.get('/groups/:groupID/pinned-messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const userID = req.userID;

    const member = await GroupMember.findOne({ groupID, userID, isActive: true });
    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      return;
    }

    const [pinnedMessages, pinnedPolls] = await Promise.all([
      GroupMessage.find({
        groupID,
        'pinnedInfo.pinnedBy': { $exists: true, $ne: null },
      }).sort({ 'pinnedInfo.pinnedAt': -1 }),
      Poll.find({ groupID, isPinned: true }).sort({ pinnedAt: -1 })
    ]);

    const enrichedMessages = await Promise.all(
      pinnedMessages.map(async (msg) => {
        const sender = await Users.findOne({ userID: msg.senderID });
        return {
          ...msg.toObject(),
          senderInfo: {
            name: sender?.name || msg.senderID,
            avatar: sender?.anhDaiDien,
          },
        };
      })
    );

    const enrichedPolls = await Promise.all(
      pinnedPolls.map(async (poll) => {
        const creator = await Users.findOne({ userID: poll.creatorID });
        return {
          messageID: poll.pollID, // Dùng pollID làm messageID cho UI ghim
          type: 'poll',
          content: poll.question,
          senderID: poll.creatorID,
          pollID: poll.pollID,
          timestamp: poll.pinnedAt || poll.createdAt,
          pinnedInfo: {
            pinnedAt: poll.pinnedAt,
            pinnedBy: poll.creatorID,
          },
          senderInfo: {
            name: creator?.name || poll.creatorID,
            avatar: creator?.anhDaiDien,
          },
        };
      })
    );

    // Kết hợp và sắp xếp theo thời gian ghim
    const allPinned = [...enrichedMessages, ...enrichedPolls].sort((a, b) => {
      const timeA = new Date(a.pinnedInfo?.pinnedAt || 0).getTime();
      const timeB = new Date(b.pinnedInfo?.pinnedAt || 0).getTime();
      return timeB - timeA;
    });

    res.json({ pinnedMessages: allPinned });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy tin nhắn ghim', error: error.message });
  }
});

export default router;
