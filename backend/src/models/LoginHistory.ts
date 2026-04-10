import mongoose, { Document, Schema } from 'mongoose';

export interface ILoginHistory extends Document {
  userID: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  deviceName: string;
  deviceId: string;
  ipAddress: string;
  loginAt: Date;
  logoutAt?: Date;
  status: 'active' | 'logged_out' | 'expired';
}

const LoginHistorySchema = new Schema<ILoginHistory>(
  {
    userID: { type: String, required: true, index: true },
    deviceType: {
      type: String,
      enum: ['web', 'mobile', 'desktop'],
      required: true,
    },
    deviceName: { type: String, required: true },
    deviceId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    loginAt: { type: Date, default: Date.now },
    logoutAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'logged_out', 'expired'],
      default: 'active',
    },
  },
  { versionKey: false }
);

// Index để query nhanh
LoginHistorySchema.index({ userID: 1, loginAt: -1 });

const LoginHistory = mongoose.model<ILoginHistory>(
  'LoginHistory',
  LoginHistorySchema,
  'LoginHistory'
);

export default LoginHistory;
