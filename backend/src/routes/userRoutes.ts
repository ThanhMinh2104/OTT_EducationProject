import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Users from '../models/User';

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
    anhDaiDien: 'https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-dien-hai-1_b33sa3.jpg',
    trangThai: 'offline',
    ngaysinh: ngaySinhDate,
    anhBia: 'https://res.cloudinary.com/dgqppqcbd/image/upload/v1741595806/anh-dai-dien-hai-1_b33sa3.jpg',
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
    if (!isMatch) return res.status(400).json({ message: 'Sai số điện thoại hoặc mật khẩu!' }) as any;

    const token = jwt.sign(
      { userID: user.userID },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES || '7d') as jwt.SignOptions['expiresIn'] }
    );

    res.status(200).json({ message: 'Đăng nhập thành công!', token, user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật trạng thái
router.post('/updateStatus', async (req: Request, res: Response) => {
  const { userID, trangThai } = req.body;
  try {
    const user = await Users.findOneAndUpdate(
      { userID },
      { $set: { trangThai } },
      { new: true }
    );
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

export default router;