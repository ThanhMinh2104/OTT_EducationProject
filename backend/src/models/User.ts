import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  userID: string;
  email: string;
  sdt: string;
  anhDaiDien?: string;
  matKhau: string;
  trangThai: 'online' | 'offline';
  ngayTao: Date;
  ngaySuaDoi: Date;
  ngaysinh?: Date;
  anhBia?: string;
  gioTinh?: 'Nam' | 'Nữ' | 'Khác';
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    userID: { type: String, unique: true, required: true },
    email: { type: String, required: true },
    sdt: { type: String, unique: true, required: true },
    anhDaiDien: { type: String },
    matKhau: { type: String, required: true },
    trangThai: { type: String, enum: ['online', 'offline'], default: 'offline' },
    ngayTao: { type: Date, default: Date.now },
    ngaySuaDoi: { type: Date, default: Date.now },
    ngaysinh: { type: Date },
    anhBia: { type: String },
    gioTinh: { type: String, enum: ['Nam', 'Nữ', 'Khác'] },
  },
  { versionKey: false }
);

export default mongoose.model<IUser>('Users', UserSchema, 'Users');