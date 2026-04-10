import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Server } from 'socket.io';
import Users from '../models/User';
import Otp from '../models/Otp';
import Chat from "../models/Chat";
import sendOtpEmail from '../services/emailService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { log } from 'console';
import { uploadToCloudinary } from '../services/uploadService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

export default function userRoutes(io: Server) {

// Tạo userID tự động
const generateUserID = async (): Promise<string> => {
  const lastUser = await Users.findOne().sort({ userID: -1 }).limit(1);
  if (!lastUser) return 'user001';
  const lastNumber = parseInt(lastUser.userID.replace('user', ''), 10);
  return `user${(lastNumber + 1).toString().padStart(3, '0')}`;
};

// Đăng ký
router.post('/registerUser', async (req: Request, res: Response) => {
  const { sdt, name, ngaySinh, matKhau, email, gioTinh } = req.body;

  if (!sdt || !name || !ngaySinh || !matKhau || !email) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' }) as any;
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
    email,
    anhDaiDien:
      'https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-dien-hai-1_b33sa3.jpg',
    trangThai: 'offline',
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
  const { sdt, matKhau } = req.body;
  try {
    const user = await Users.findOne({ sdt });
    if (!user) return res.status(400).json({ message: 'Sai số điện thoại hoặc mật khẩu!' }) as any;

    const isMatch = await bcrypt.compare(matKhau, user.matKhau);
    if (!isMatch)
      return res.status(400).json({ message: 'Sai số điện thoại hoặc mật khẩu!' }) as any;

    const token = jwt.sign({ userID: user.userID }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES || '7d') as jwt.SignOptions['expiresIn'],
    });

    res.status(200).json({ message: 'Đăng nhập thành công!', token, user });
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
router.post('/upload', authMiddleware, upload.array('files'), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' }) as any;

    const urls = await Promise.all(files.map((file) => uploadToCloudinary(file)));
    res.json({ urls });
  } catch (error: any) {
    res.status(500).json({ error: 'Upload failed' });
  }
})
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


// Yêu cầu OTP để đổi mật khẩu (xác thực mật khẩu cũ trước, rồi gửi OTP)
router.post('/users/:userID/request-password-otp', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userID } = req.params;
  if (req.userID !== userID) {
    return res.status(403).json({ message: 'Không có quyền thực hiện thao tác này' }) as any;
  }
  const { matKhauCu } = req.body;
  if (!matKhauCu) {
    return res.status(400).json({ message: 'Vui lòng nhập mật khẩu cũ' }) as any;
  }
  try {
    const user = await Users.findOne({ userID });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;

    const isMatch = await bcrypt.compare(matKhauCu, user.matKhau);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không đúng' }) as any;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email: user.email });
    await Otp.create({ email: user.email, otp });
    await sendOtpEmail(user.email, otp);

    res.status(200).json({ message: 'Đã gửi OTP về email', email: user.email });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Đổi mật khẩu khi đã đăng nhập (yêu cầu JWT, check trùng mật khẩu cũ)
router.put('/users/:userID/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userID } = req.params;

  if (req.userID !== userID) {
    return res.status(403).json({ message: 'Không có quyền thực hiện thao tác này' }) as any;
  }

  const { matKhauMoi, otp, email } = req.body;
  if (!matKhauMoi || !otp || !email) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' }) as any;
  }

  try {
    // Xác thực OTP
    const otpRecord = await Otp.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn' }) as any;
    }
    await Otp.deleteOne({ _id: otpRecord._id });

    const user = await Users.findOne({ userID });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' }) as any;

    const isSame = await bcrypt.compare(matKhauMoi, user.matKhau);
    if (isSame) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng mật khẩu cũ' }) as any;
    }

    const salt = await bcrypt.genSalt(10);
    user.matKhau = await bcrypt.hash(matKhauMoi, salt);
    user.ngaySuaDoi = new Date();
    await user.save();

    // Emit force logout tới tất cả thiết bị của user này
    io.emit('forceLogout', { userID });

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
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
    res.status(200).json({ email: user.email, sdt: user.sdt });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy thông tin từ email hoặc SĐT (dùng cho luồng quên mật khẩu)
router.post('/users/find-by-identity', async (req: Request, res: Response) => {
  const { identity } = req.body;
  if (!identity) return res.status(400).json({ message: 'Vui lòng nhập SĐT hoặc email' }) as any;
  try {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity);
    const user = isEmail
      ? await Users.findOne({ email: identity })
      : await Users.findOne({ sdt: identity });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với thông tin này' }) as any;
    }
    res.status(200).json({ email: user.email, sdt: user.sdt });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

  return router;
}



