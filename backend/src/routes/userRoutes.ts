import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Users from '../models/User';
import Otp from '../models/Otp';
import Session from '../models/Session';
import LoginHistory from '../models/LoginHistory';
import sendOtpEmail from '../services/emailService';
import { sendOtpSMS } from '../services/smsService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../services/uploadService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

// Tạo userID tự động
const generateUserID = async (): Promise<string> => {
  const lastUser = await Users.findOne().sort({ userID: -1 }).limit(1);
  if (!lastUser) return 'user001';
  const lastNumber = parseInt(lastUser.userID.replace('user', ''), 10);
  return `user${(lastNumber + 1).toString().padStart(3, '0')}`;
};

// Đăng ký
router.post('/registerUser', async (req: Request, res: Response) => {
  const { sdt, name, ngaySinh, matKhau, email, gioTinh, dongYDieuKhoan } = req.body;

  if (!sdt || !name || !ngaySinh || !matKhau) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' }) as any;
  }

  // Kiểm tra đồng ý điều khoản
  if (!dongYDieuKhoan) {
    return res.status(400).json({ message: 'Bạn phải đồng ý với điều khoản sử dụng' }) as any;
  }

  const userExists = await Users.findOne({ sdt });
  if (userExists) return res.status(400).json({ message: 'Số điện thoại đã được đăng ký' }) as any;

  const [day, month, year] = ngaySinh.split('/');
  const ngaySinhDate = new Date(`${year}-${month}-${day}`);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(matKhau, salt);
  const userid = await generateUserID();

  const user = await Users.create({
    name,
    userID: userid,
    ...(email ? { email } : {}),
    anhDaiDien:
      'https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-dien-hai-1_b33sa3.jpg',
    trangThai: 'offline',
    trangThaiTaiKhoan: 'active',
    dongYDieuKhoan: true,
    ngaysinh: ngaySinhDate,
    anhBia:
      'https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-dien-hai-1_b33sa3.jpg',
    gioTinh,
    sdt,
    matKhau: hashedPassword,
  });

  if (user) {
    res.status(201).json({ message: 'Đăng ký thành công', userId: user._id });
  } else {
    res.status(400).json({ message: 'Đăng ký thất bại' });
  }
});

// Đăng nhập
router.post('/login', async (req: Request, res: Response) => {
  const { sdt, matKhau, deviceType, deviceName, deviceId } = req.body;

  try {
    const user = await Users.findOne({ sdt });
    if (!user) return res.status(400).json({ message: 'Sai số điện thoại hoặc mật khẩu!' }) as any;

    const isMatch = await bcrypt.compare(matKhau, user.matKhau);
    if (!isMatch)
      return res.status(400).json({ message: 'Sai số điện thoại hoặc mật khẩu!' }) as any;

    // KIỂM TRA TÀI KHOẢN BỊ KHÓA TRƯỚC KHI CHO ĐĂNG NHẬP
    if (user.trangThaiTaiKhoan === 'locked') {
      return res.status(403).json({
        message: 'Tài khoản của bạn đã bị khóa',
        reason: user.lyDoKhoa || 'Vi phạm điều khoản',
        isLocked: true,
        canUnlock: user.lyDoKhoa?.includes('tự vô hiệu hóa') || false,
      }) as any;
    }

    // Tạo JWT token với sessionId unique để mỗi lần đăng nhập có token khác nhau
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const token = jwt.sign(
      {
        userID: user.userID,
        sessionId: sessionId,
        deviceType: deviceType || 'web',
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: (process.env.JWT_EXPIRES || '7d') as jwt.SignOptions['expiresIn'],
      }
    );

    // Tính thời gian hết hạn (7 ngày)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Lấy IP address
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    const finalDeviceType = deviceType || 'web';

    console.log('=== LOGIN DEBUG ===');
    console.log('UserID:', user.userID);
    console.log('Device Type:', finalDeviceType);
    console.log('Device Name:', deviceName);
    console.log('Device ID:', deviceId);

    // LOGIC MỚI:
    // - Web + Mobile: OK (có thể cùng lúc)
    // - Web + Web: Chỉ 1 web (web mới đẩy web cũ ra)
    // - Mobile + Mobile: Chỉ 1 mobile (mobile mới đẩy mobile cũ ra)

    // Xóa tất cả sessions cũ của CÙNG deviceType (web hoặc mobile)
    console.log(`Deleting all old ${finalDeviceType} sessions...`);
    const oldSessions = await Session.find({
      userID: user.userID,
      deviceType: finalDeviceType,
    });

    // Cập nhật LoginHistory cho các session bị đẩy ra
    for (const oldSession of oldSessions) {
      await LoginHistory.findOneAndUpdate(
        {
          userID: user.userID,
          deviceId: oldSession.deviceId,
          status: 'active',
        },
        {
          logoutAt: new Date(),
          status: 'logged_out',
        }
      );
    }

    // Xóa các session cũ
    const deleteResult = await Session.deleteMany({
      userID: user.userID,
      deviceType: finalDeviceType,
    });
    console.log('Deleted sessions:', deleteResult.deletedCount);

    // Tạo session mới
    const finalDeviceId = deviceId || `${Date.now()}-${Math.random()}`;
    await Session.create({
      userID: user.userID,
      token,
      deviceType: finalDeviceType,
      deviceName: deviceName || 'Unknown Device',
      deviceId: finalDeviceId,
      ipAddress,
      expiresAt,
    });

    // Lưu vào LoginHistory
    await LoginHistory.create({
      userID: user.userID,
      deviceType: finalDeviceType,
      deviceName: deviceName || 'Unknown Device',
      deviceId: finalDeviceId,
      ipAddress,
      loginAt: new Date(),
      status: 'active',
    });

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      token,
      user,
      sessionInfo: {
        deviceType: finalDeviceType,
        deviceName: deviceName || 'Unknown Device',
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật trạng thái
router.post('/updateStatus', async (req: Request, res: Response) => {
  const { userID, trangThai } = req.body;
  try {
    const user = await Users.findOneAndUpdate({ userID }, { $set: { trangThai } }, { new: true });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kiểm tra số điện thoại
router.post('/users/checksdt', async (req: Request, res: Response) => {
  const { sdt } = req.body;
  try {
    const userExists = await Users.exists({ sdt });
    res.json({ exists: !!userExists });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kiểm tra email
router.post('/users/email', async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const userExists = await Users.exists({ email });
    res.json({ exists: !!userExists });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gửi OTP
router.post('/send-otp', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Thiếu địa chỉ email' }) as any;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Xóa OTP cũ của email này (nếu có)
    await Otp.deleteMany({ email });

    // Lưu OTP mới vào database
    await Otp.create({ email, otp });

    // Gửi email
    await sendOtpEmail(email, otp);

    res.status(200).json({ message: 'Gửi OTP thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gửi OTP thất bại', error: error.message });
  }
});

// Xác thực OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    // Tìm OTP trong database
    const otpRecord = await Otp.findOne({ email, otp });

    console.log(otpRecord);

    if (!otpRecord) {
      return res.json({ message: 'Mã OTP không đúng hoặc đã hết hạn', verified: false }) as any;
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Xác thực OTP thành công', verified: true });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xác thực OTP', error: error.message });
  }
});

// Gửi OTP qua SMS (InfiniReach)
router.post('/send-otp-sms', async (req: Request, res: Response) => {
  const { sdt } = req.body;
  if (!sdt) return res.status(400).json({ message: 'Thiếu số điện thoại' }) as any;

  // Validate SĐT (10 số, bắt đầu bằng 0)
  if (!/^0\d{9}$/.test(sdt)) {
    return res.status(400).json({ message: 'Số điện thoại không hợp lệ' }) as any;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Xóa OTP cũ của SĐT này (nếu có)
    await Otp.deleteMany({ sdt });

    // Lưu OTP mới vào database
    await Otp.create({ sdt, otp });

    // Trả response ngay (gửi SMS ở background để không bắt user đợi)
    res.status(200).json({ message: 'Đã gửi mã OTP qua SMS' });

    // Gửi SMS ở background (fire-and-forget)
    sendOtpSMS(sdt, otp).catch(() => {
      // Bỏ qua lỗi background - đã có timeout/retry trong service
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Gửi OTP thất bại', error: error.message });
  }
});

// Xác thực OTP từ SMS
router.post('/verify-otp-sms', async (req: Request, res: Response) => {
  const { sdt, otp } = req.body;
  try {
    const otpRecord = await Otp.findOne({ sdt, otp });

    if (!otpRecord) {
      return res.json({ message: 'Mã OTP không đúng hoặc đã hết hạn', verified: false }) as any;
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Xác thực OTP thành công', verified: true });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xác thực OTP', error: error.message });
  }
});

// Lấy user theo userID
router.post('/usersID', async (req: Request, res: Response) => {
  const { userID } = req.body;
  try {
    const user = await Users.findOne({ userID });
    if (!user) return res.status(404).json({ message: 'User not found' }) as any;
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy nhiều users cùng lúc (batch)
router.post('/users/batch', async (req: Request, res: Response) => {
  const { userIDs } = req.body;
  
  if (!Array.isArray(userIDs) || userIDs.length === 0) {
    return res.status(400).json({ message: 'userIDs must be a non-empty array' }) as any;
  }

  try {
    const users = await Users.find({ userID: { $in: userIDs } }).select('userID name anhDaiDien email sdt');
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật thông tin người dùng (yêu cầu JWT)
router.put('/users/:userID', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userID } = req.params;

  // Chỉ cho phép cập nhật chính mình
  if (req.userID !== userID) {
    return res.status(403).json({ message: 'Không có quyền cập nhật tài khoản này' }) as any;
  }

  const { name, email, sdt, ngaysinh, gioTinh, anhDaiDien, anhBia } = req.body;
  try {
    const user = await Users.findOne({ userID });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại!' }) as any;

    if (name) user.name = name;
    if (email) user.email = email;
    if (sdt) user.sdt = sdt;
    if (ngaysinh) user.ngaysinh = new Date(ngaysinh);
    if (gioTinh && ['Nam', 'Nữ', 'Khác'].includes(gioTinh)) user.gioTinh = gioTinh;
    if (anhDaiDien) user.anhDaiDien = anhDaiDien;
    if (anhBia) user.anhBia = anhBia;
    user.ngaySuaDoi = new Date();

    await user.save();
    res.status(200).json({ message: 'Cập nhật thành công!', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi hệ thống', error: error.message });
  }
});

// Upload ảnh (yêu cầu JWT)
router.post(
  '/upload',
  authMiddleware,
  upload.array('files'),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0)
        return res.status(400).json({ error: 'No files uploaded' }) as any;

      const urls = await Promise.all(files.map((file) => uploadToCloudinary(file)));
      res.json({ urls });
    } catch (error: any) {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);
// Đặt lại mật khẩu sau khi người dùng xác thực OTP thành công
router.post('/users/doimatkhau', async (req: Request, res: Response) => {
  const { sdt, matKhauMoi } = req.body;

  if (!sdt || !matKhauMoi) {
    return res.status(400).json({ message: 'Thiếu số điện thoại hoặc mật khẩu mới' }) as any;
  }

  try {
    const user = await Users.findOne({ sdt });
    if (!user) {
      return res.status(404).json({ message: 'Số điện thoại không tồn tại' }) as any;
    }

    // Check không được trùng mật khẩu cũ
    const isSame = await bcrypt.compare(matKhauMoi, user.matKhau);
    if (isSame) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng mật khẩu cũ' }) as any;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(matKhauMoi, salt);

    await Users.findOneAndUpdate({ sdt }, { $set: { matKhau: hashedPassword } });

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu', error: error.message });
  }
});

// Đổi mật khẩu khi đã đăng nhập (yêu cầu JWT, check trùng mật khẩu cũ)
router.put('/users/:userID/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userID } = req.params;

  if (req.userID !== userID) {
    return res.status(403).json({ message: 'Không có quyền thực hiện thao tác này' }) as any;
  }

  const { matKhauCu, matKhauMoi } = req.body;
  if (!matKhauCu || !matKhauMoi) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới' }) as any;
  }

  try {
    const user = await Users.findOne({ userID });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;

    const isMatch = await bcrypt.compare(matKhauCu, user.matKhau);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không đúng' }) as any;
    }

    const isSame = await bcrypt.compare(matKhauMoi, user.matKhau);
    if (isSame) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng mật khẩu cũ' }) as any;
    }

    const salt = await bcrypt.genSalt(10);
    user.matKhau = await bcrypt.hash(matKhauMoi, salt);
    user.ngaySuaDoi = new Date();
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy thông tin public của user theo userID (dùng cho QR kết bạn)
router.get('/users/qr-profile/:userID', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userID } = req.params;
  const currentUserID = req.userID!;
  try {
    const user = await Users.findOne({ userID }).select('userID name sdt anhDaiDien anhBia gioTinh trangThai');
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;

    // Kiểm tra trạng thái bạn bè
    const contact = await (await import('../models/Contacts')).default.findOne({
      $or: [
        { userID: currentUserID, contactID: userID },
        { userID: userID, contactID: currentUserID },
      ],
    });

    let friendStatus: string = 'none';
    if (userID === currentUserID) {
      friendStatus = 'self';
    } else if (contact) {
      if (contact.status === 'accepted') {
        friendStatus = 'accepted';
      } else if (contact.status === 'pending') {
        friendStatus = contact.userID === currentUserID ? 'pending_sent' : 'pending_received';
      }
    }

    res.json({ ...user.toObject(), friendStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy email từ số điện thoại (dùng cho luồng quên mật khẩu)
router.post('/users/get-email-by-phone', async (req: Request, res: Response) => {
  const { sdt } = req.body;
  try {
    const user = await Users.findOne({ sdt });
    if (!user) {
      return res.status(404).json({ message: 'Số điện thoại không tồn tại' }) as any;
    }
    // Chỉ trả về email để frontend gọi API gửi OTP
    res.status(200).json({ email: user.email });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

export default router;
