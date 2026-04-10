import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Session from '../models/Session';
import Users from '../models/User';

export interface AuthRequest extends Request {
  userID?: string;
  sessionId?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Không có token xác thực' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userID: string;
      sessionId?: string;
      deviceType?: string;
    };

    // Check if session exists and is valid
    const session = await Session.findOne({
      token,
      userID: decoded.userID,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
      return;
    }

    // Check if account is locked
    const user = await Users.findOne({ userID: decoded.userID });
    if (!user) {
      res.status(401).json({ message: 'Tài khoản không tồn tại' });
      return;
    }

    if (user.trangThaiTaiKhoan === 'locked') {
      res.status(403).json({
        message: 'Tài khoản của bạn đã bị khóa',
        reason: user.lyDoKhoa || 'Vi phạm điều khoản sử dụng',
        lockedAt: user.ngayKhoa,
      });
      return;
    }

    // Update last active time
    session.lastActive = new Date();
    await session.save();

    req.userID = decoded.userID;
    req.sessionId = session._id.toString();
    next();
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};
