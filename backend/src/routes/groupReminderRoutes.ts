import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import GroupReminder from '../models/GroupReminder';
import GroupMember from '../models/GroupMember';
import User from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Helper: enrich participants with user info
const enrichParticipants = async (participants: any[]) => {
  return Promise.all(
    participants.map(async (p) => {
      const user = await User.findOne({ userID: p.userID }).select('name anhDaiDien');
      return {
        userID: p.userID,
        status: p.status,
        updatedAt: p.updatedAt,
        name: user?.name || p.userID,
        avatar: user?.anhDaiDien || null,
      };
    })
  );
};

// GET /group-reminders/:groupID - lấy tất cả nhắc hẹn của nhóm
router.get('/:groupID', authMiddleware, async (req, res) => {
  try {
    const { groupID } = req.params;
    const reminders = await GroupReminder.find({ groupID }).sort({ datetime: 1 });

    const enriched = await Promise.all(
      reminders.map(async (r) => ({
        ...r.toObject(),
        participants: await enrichParticipants(r.participants),
      }))
    );

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching group reminders:', error);
    res.status(500).json({ error: 'Failed to fetch group reminders' });
  }
});

// POST /group-reminders - tạo nhắc hẹn nhóm
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { groupID, creatorID, title, datetime, repeat, note } = req.body;

    // Lấy tất cả thành viên nhóm để tạo participants với status pending
    const members = await GroupMember.find({ groupID, isActive: true }).select('userID');
    const participants = members.map((m) => ({
      userID: m.userID,
      status: m.userID === creatorID ? 'pending' : 'pending',
      updatedAt: new Date(),
    }));

    const reminderID = `grem_${uuidv4()}`;
    const reminder = new GroupReminder({
      reminderID,
      groupID,
      creatorID,
      title,
      datetime: new Date(datetime),
      repeat: repeat || 'none',
      note: note || '',
      participants,
      done: false,
    });

    await reminder.save();

    const enriched = {
      ...reminder.toObject(),
      participants: await enrichParticipants(reminder.participants),
    };

    res.json(enriched);
  } catch (error) {
    console.error('Error creating group reminder:', error);
    res.status(500).json({ error: 'Failed to create group reminder' });
  }
});

// PUT /group-reminders/:reminderID/rsvp - tham gia hoặc từ chối
router.put('/:reminderID/rsvp', authMiddleware, async (req, res) => {
  try {
    const { reminderID } = req.params;
    const { userID, status } = req.body; // status: 'joined' | 'declined'

    if (!['joined', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const reminder = await GroupReminder.findOne({ reminderID });
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Kiểm tra user có trong nhóm không
    const member = await GroupMember.findOne({ groupID: reminder.groupID, userID, isActive: true });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Cập nhật hoặc thêm participant
    const existingIdx = reminder.participants.findIndex((p) => p.userID === userID);
    if (existingIdx >= 0) {
      reminder.participants[existingIdx].status = status;
      reminder.participants[existingIdx].updatedAt = new Date();
    } else {
      reminder.participants.push({ userID, status, updatedAt: new Date() });
    }

    await reminder.save();

    const enriched = {
      ...reminder.toObject(),
      participants: await enrichParticipants(reminder.participants),
    };

    res.json(enriched);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Failed to update RSVP' });
  }
});

// DELETE /group-reminders/:reminderID - xóa nhắc hẹn (chỉ creator hoặc admin/owner)
router.delete('/:reminderID', authMiddleware, async (req, res) => {
  try {
    const { reminderID } = req.params;
    const { userID } = req.body;

    const reminder = await GroupReminder.findOne({ reminderID });
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Kiểm tra quyền: creator hoặc admin/owner
    const member = await GroupMember.findOne({ groupID: reminder.groupID, userID, isActive: true });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const canDelete =
      reminder.creatorID === userID ||
      member.role === 'owner' ||
      member.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({ error: 'No permission to delete this reminder' });
    }

    await GroupReminder.deleteOne({ reminderID });
    res.json({ message: 'Reminder deleted', reminderID });
  } catch (error) {
    console.error('Error deleting group reminder:', error);
    res.status(500).json({ error: 'Failed to delete group reminder' });
  }
});

// PUT /group-reminders/:reminderID/done - đánh dấu hoàn thành
router.put('/:reminderID/done', authMiddleware, async (req, res) => {
  try {
    const { reminderID } = req.params;
    const { userID } = req.body;

    const reminder = await GroupReminder.findOne({ reminderID });
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const member = await GroupMember.findOne({ groupID: reminder.groupID, userID, isActive: true });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const canMarkDone =
      reminder.creatorID === userID ||
      member.role === 'owner' ||
      member.role === 'admin';

    if (!canMarkDone) {
      return res.status(403).json({ error: 'No permission' });
    }

    reminder.done = true;
    await reminder.save();

    res.json({ ...reminder.toObject() });
  } catch (error) {
    console.error('Error marking reminder done:', error);
    res.status(500).json({ error: 'Failed to mark reminder done' });
  }
});

export default router;
