import { Router, Response } from 'express';
import Session from '../models/Session';
import LoginHistory from '../models/LoginHistory';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Lấy danh sách thiết bị đang đăng nhập
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({
      userID: req.userID,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActive: -1 });

    const sessionList = sessions.map((session) => ({
      sessionId: session._id,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      lastActive: session.lastActive,
      createdAt: session.createdAt,
      isCurrent: session._id.toString() === req.sessionId,
    }));

    res.status(200).json({ sessions: sessionList });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách thiết bị', error: error.message });
  }
});

// Logout thiết bị cụ thể (logout từ xa)
router.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userID: req.userID,
    });

    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy phiên đăng nhập' }) as any;
    }

    // Cập nhật LoginHistory
    await LoginHistory.findOneAndUpdate(
      {
        userID: req.userID,
        deviceId: session.deviceId,
        status: 'active',
      },
      {
        logoutAt: new Date(),
        status: 'logged_out',
      }
    );

    await Session.deleteOne({ _id: sessionId });

    res.status(200).json({ message: 'Đã đăng xuất thiết bị thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi đăng xuất thiết bị', error: error.message });
  }
});

// Logout tất cả thiết bị khác (giữ lại thiết bị hiện tại)
router.delete('/sessions/others/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const otherSessions = await Session.find({
      userID: req.userID,
      _id: { $ne: req.sessionId },
    });

    // Cập nhật LoginHistory cho tất cả sessions bị logout
    for (const session of otherSessions) {
      await LoginHistory.findOneAndUpdate(
        {
          userID: req.userID,
          deviceId: session.deviceId,
          status: 'active',
        },
        {
          logoutAt: new Date(),
          status: 'logged_out',
        }
      );
    }

    await Session.deleteMany({
      userID: req.userID,
      _id: { $ne: req.sessionId },
    });

    res.status(200).json({ message: 'Đã đăng xuất tất cả thiết bị khác' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi đăng xuất các thiết bị', error: error.message });
  }
});

// Logout thiết bị hiện tại
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.sessionId });

    if (session) {
      // Cập nhật LoginHistory
      await LoginHistory.findOneAndUpdate(
        {
          userID: req.userID,
          deviceId: session.deviceId,
          status: 'active',
        },
        {
          logoutAt: new Date(),
          status: 'logged_out',
        }
      );
    }

    await Session.deleteOne({ _id: req.sessionId });
    res.status(200).json({ message: 'Đăng xuất thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi đăng xuất', error: error.message });
  }
});

// Lấy lịch sử đăng nhập (50 lần gần nhất)
router.get('/login-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const history = await LoginHistory.find({
      userID: req.userID,
    })
      .sort({ loginAt: -1 })
      .limit(50);

    res.status(200).json({ history });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử đăng nhập', error: error.message });
  }
});

export default router;
