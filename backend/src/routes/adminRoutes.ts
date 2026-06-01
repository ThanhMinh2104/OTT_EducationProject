import { Router, Request, Response } from 'express';
import Users from '../models/User';
import Session from '../models/Session';
import Otp from '../models/Otp';
import sendOtpEmail from '../services/emailService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware kiểm tra quyền admin
const adminMiddleware = async (req: AuthRequest, res: Response, next: Function) => {
  try {
    const user = await Users.findOne({ userID: req.userID });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập' }) as any;
    }
    next();
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xác thực quyền', error: error.message });
  }
};

// User tự vô hiệu hóa tài khoản (không cần admin)
router.post('/users/self-deactivate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await Users.findOne({ userID: req.userID });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;
    }

    // Khóa tài khoản
    user.trangThaiTaiKhoan = 'locked';
    user.lyDoKhoa = 'Người dùng tự vô hiệu hóa tài khoản';
    user.ngayKhoa = new Date();
    await user.save();

    // Xóa tất cả sessions của user
    await Session.deleteMany({ userID: req.userID });

    res.status(200).json({ message: 'Tài khoản đã được vô hiệu hóa thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi vô hiệu hóa tài khoản', error: error.message });
  }
});

// Gửi OTP để mở khóa tài khoản (không cần đăng nhập)
router.post('/users/unlock/send-otp', async (req: Request, res: Response) => {
  const { sdt } = req.body;

  try {
    const user = await Users.findOne({ sdt });
    if (!user) {
      return res.status(404).json({ message: 'Số điện thoại không tồn tại' }) as any;
    }

    // Chỉ cho phép mở khóa nếu tài khoản bị khóa bởi chính user
    if (user.trangThaiTaiKhoan !== 'locked') {
      return res.status(400).json({ message: 'Tài khoản không bị khóa' }) as any;
    }

    if (user.lyDoKhoa && !user.lyDoKhoa.includes('tự vô hiệu hóa')) {
      return res.status(403).json({
        message: 'Tài khoản bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ.',
        reason: user.lyDoKhoa,
      }) as any;
    }

    // Tạo và gửi OTP
    if (!user.email) {
      return res.status(400).json({
        message: 'Tài khoản này không có email đăng ký. Vui lòng liên hệ hỗ trợ.',
      }) as any;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email: user.email });
    await Otp.create({ email: user.email, otp });
    await sendOtpEmail(user.email, otp);

    res.status(200).json({
      message: 'Mã OTP đã được gửi đến email của bạn',
      email: user.email,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi gửi OTP', error: error.message });
  }
});

// Xác nhận OTP và mở khóa tài khoản (không cần đăng nhập)
router.post('/users/unlock/verify-otp', async (req: Request, res: Response) => {
  const { sdt, otp } = req.body;

  try {
    const user = await Users.findOne({ sdt });
    if (!user) {
      return res.status(404).json({ message: 'Số điện thoại không tồn tại' }) as any;
    }

    // Kiểm tra OTP
    const otpRecord = await Otp.findOne({ email: user.email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn' }) as any;
    }

    // Mở khóa tài khoản
    user.trangThaiTaiKhoan = 'active';
    user.lyDoKhoa = undefined;
    user.ngayKhoa = undefined;
    await user.save();

    // Xóa OTP đã sử dụng
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      message: 'Tài khoản đã được mở khóa thành công. Bạn có thể đăng nhập lại.',
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi mở khóa tài khoản', error: error.message });
  }
});

// ============ ADMIN ROUTES (Cần quyền admin) ============

// Lấy danh sách tất cả users (Admin)
router.get('/admin/users', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await Users.find().select('-matKhau').sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách users', error: error.message });
  }
});

// Admin khóa tài khoản
router.post(
  '/admin/users/:userID/lock',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userID } = req.params;
      const { lyDoKhoa } = req.body;

      if (!lyDoKhoa) {
        return res.status(400).json({ message: 'Vui lòng cung cấp lý do khóa tài khoản' }) as any;
      }

      const user = await Users.findOne({ userID });
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;
      }

      user.trangThaiTaiKhoan = 'locked';
      user.lyDoKhoa = lyDoKhoa;
      user.ngayKhoa = new Date();
      await user.save();

      // Xóa tất cả sessions của user
      await Session.deleteMany({ userID });

      // Buộc đăng xuất real-time trên mọi thiết bị (web + mobile)
      const io = req.app.get('io');
      if (io) {
        io.to(userID).emit('forceLogout', { userID, reason: lyDoKhoa });
      }

      res.status(200).json({
        message: 'Đã khóa tài khoản thành công',
        user: {
          userID: user.userID,
          name: user.name,
          trangThaiTaiKhoan: user.trangThaiTaiKhoan,
          lyDoKhoa: user.lyDoKhoa,
          ngayKhoa: user.ngayKhoa,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi khi khóa tài khoản', error: error.message });
    }
  }
);

// Admin mở khóa tài khoản
router.post(
  '/admin/users/:userID/unlock',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userID } = req.params;

      const user = await Users.findOne({ userID });
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;
      }

      user.trangThaiTaiKhoan = 'active';
      user.lyDoKhoa = undefined;
      user.ngayKhoa = undefined;
      await user.save();

      res.status(200).json({
        message: 'Đã mở khóa tài khoản thành công',
        user: {
          userID: user.userID,
          name: user.name,
          trangThaiTaiKhoan: user.trangThaiTaiKhoan,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi khi mở khóa tài khoản', error: error.message });
    }
  }
);

// Lấy thông tin chi tiết user (Admin)
router.get(
  '/admin/users/:userID',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userID } = req.params;
      const user = await Users.findOne({ userID }).select('-matKhau');

      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;
      }

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi khi lấy thông tin user', error: error.message });
    }
  }
);

export default router;
