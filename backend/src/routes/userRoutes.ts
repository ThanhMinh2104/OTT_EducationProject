import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Users from '../models/User';
import Otp from '../models/Otp';
import sendOtpEmail from '../services/emailService';
import { log } from 'console';

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

// Đặt lại mật khẩu sau khi người dùng xác thực OTP thành công
router.post('/users/doimatkhau', async (req: Request, res: Response) => {
  const { sdt, matKhauMoi } = req.body;

  // Kiểm tra đầu vào
  if (!sdt || !matKhauMoi) {
    return res.status(400).json({ message: 'Thiếu số điện thoại hoặc mật khẩu mới' }) as any;
  }

  try {
    // Tìm người dùng theo số điện thoại
    const user = await Users.findOne({ sdt });
    if (!user) {
      return res.status(404).json({ message: 'Số điện thoại không tồn tại' }) as any;
    }

    // Mã hóa mật khẩu mới trước khi lưu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(matKhauMoi, salt);

    // Cập nhật mật khẩu mới vào database
    await Users.findOneAndUpdate({ sdt }, { $set: { matKhau: hashedPassword } });

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu', error: error.message });
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

