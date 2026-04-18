import mongoose, { Document, Schema } from 'mongoose';

export interface IGroupJoinRequest extends Document {
  requestID: string;
  groupID: string;
  userID: string;       // người được đề xuất tham gia
  requestedBy: string;  // member thường đã thêm
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

const GroupJoinRequestSchema = new Schema<IGroupJoinRequest>(
  {
    requestID: { type: String, unique: true, required: true },
    groupID: { type: String, required: true, index: true },
    userID: { type: String, required: true },
    requestedBy: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

GroupJoinRequestSchema.index({ groupID: 1, status: 1 });

export default mongoose.model<IGroupJoinRequest>('GroupJoinRequests', GroupJoinRequestSchema, 'GroupJoinRequests');
