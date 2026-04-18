import express, { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import GroupMessage from '../models/GroupMessage';
import GroupMember from '../models/GroupMember';

const router = Router();

// Lấy media gallery của group
router.get('/groups/:groupID/media', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { type = 'image', page = 1, limit = 20 } = req.query;
    const userID = req.userID;

    // Kiểm tra user có trong group không
    const member = await GroupMember.findOne({
      groupID,
      userID,
      isActive: true,
    });

    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập' });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Lấy messages có media
    const messages = await GroupMessage.find({
      groupID,
      type: type === 'image' ? 'image' : type === 'video' ? 'video' : { $in: ['image', 'video'] },
      media_url: { $exists: true, $ne: [] },
      deletedFor: { $ne: userID },
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await GroupMessage.countDocuments({
      groupID,
      type: type === 'image' ? 'image' : type === 'video' ? 'video' : { $in: ['image', 'video'] },
      media_url: { $exists: true, $ne: [] },
      deletedFor: { $ne: userID },
    });

    const media = messages.flatMap((msg) =>
      msg.media_url.map((url) => ({
        url,
        messageID: msg.messageID,
        senderID: msg.senderID,
        timestamp: msg.timestamp,
        type: msg.type,
      }))
    );

    res.json({
      media,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy media', error: error.message });
  }
});

// Lấy files của group
router.get('/groups/:groupID/files', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { groupID } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userID = req.userID;

    // Kiểm tra user có trong group không
    const member = await GroupMember.findOne({
      groupID,
      userID,
      isActive: true,
    });

    if (!member) {
      res.status(403).json({ message: 'Bạn không có quyền truy cập' });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await GroupMessage.find({
      groupID,
      type: { $in: ['file', 'doc', 'audio'] },
      media_url: { $exists: true, $ne: [] },
      deletedFor: { $ne: userID },
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await GroupMessage.countDocuments({
      groupID,
      type: { $in: ['file', 'doc', 'audio'] },
      media_url: { $exists: true, $ne: [] },
      deletedFor: { $ne: userID },
    });

    const files = messages.flatMap((msg) =>
      msg.media_url.map((url) => ({
        url,
        messageID: msg.messageID,
        senderID: msg.senderID,
        timestamp: msg.timestamp,
        type: msg.type,
        fileName: url.split('/').pop(),
      }))
    );

    res.json({
      files,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy files', error: error.message });
  }
});

export default router;
