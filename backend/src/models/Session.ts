import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
  userID: string;
  token: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  deviceName: string; // "Chrome on Windows", "iPhone 13"
  deviceId: string; // Unique device identifier
  ipAddress: string;
  lastActive: Date;
  createdAt: Date;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userID: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    deviceType: {
      type: String,
      enum: ['web', 'mobile', 'desktop'],
      required: true,
    },
    deviceName: { type: String, required: true },
    deviceId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

// Index để query nhanh
SessionSchema.index({ userID: 1, deviceId: 1 });
SessionSchema.index({ token: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto delete expired sessions

export default mongoose.model<ISession>('Sessions', SessionSchema, 'Sessions');
