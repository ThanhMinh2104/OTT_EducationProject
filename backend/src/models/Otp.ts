import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  email?: string;   // Email (cho OTP qua email)
  sdt?: string;     // Số điện thoại (cho OTP qua SMS)
  otp: string;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  email: { type: String, required: false },
  sdt: { type: String, required: false },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // Tự động xóa sau 5 phút
});

export default mongoose.model<IOtp>('Otps', OtpSchema, 'Otps');
