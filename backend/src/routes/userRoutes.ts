import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Users from '../models/User';

const router = Router();

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

export default router;