import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  userID: string;
  email?: string;
  sdt: string;
  anhDaiDien?: string;
  matKhau: string;
  trangThai: 'online' | 'offline';
  trangThaiTaiKhoan: 'active' | 'locked'; // Trạng thái tài khoản
  lyDoKhoa?: string; // Lý do khóa tài khoản
  ngayKhoa?: Date; // Ngày khóa
  role?: 'user' | 'admin'; // Quyền hạn
  ngayTao: Date;
  ngaySuaDoi: Date;
  ngaysinh?: Date;
  anhBia?: string;
  gioTinh?: 'Nam' | 'Nữ' | 'Khác';
  dongYDieuKhoan: boolean; // Đồng ý điều khoản khi đăng ký
  blockedUsers: string[]; // Danh sách userID bị chặn
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    userID: { type: String, unique: true, required: true },
    email: { type: String },
    sdt: { type: String, unique: true, required: true },
    anhDaiDien: { type: String },
    matKhau: { type: String, required: true },
    trangThai: { type: String, enum: ['online', 'offline'], default: 'offline' },
    trangThaiTaiKhoan: { type: String, enum: ['active', 'locked'], default: 'active' },
    lyDoKhoa: { type: String },
    ngayKhoa: { type: Date },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    ngayTao: { type: Date, default: Date.now },
    ngaySuaDoi: { type: Date, default: Date.now },
    ngaysinh: { type: Date },
    anhBia: { type: String },
    gioTinh: { type: String, enum: ['Nam', 'Nữ', 'Khác'] },
    dongYDieuKhoan: { type: Boolean, default: false },
    blockedUsers: { type: [String], default: [] },
  },
  { versionKey: false }
);

export default mongoose.model<IUser>('Users', UserSchema, 'Users');
