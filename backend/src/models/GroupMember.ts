import mongoose, { Document, Schema } from 'mongoose';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface IGroupMember extends Document {
  groupID: string;
  userID: string;
  role: GroupRole;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  historyDeletedAt?: Date; // Thời điểm user xóa lịch sử chat
}

const GroupMemberSchema = new Schema<IGroupMember>(
  {
    groupID: { type: String, required: true, index: true },
    userID: { type: String, required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    isActive: { type: Boolean, default: true },
    historyDeletedAt: { type: Date }, // Thời điểm user xóa lịch sử chat
  },
  { versionKey: false }
);

// Compound index để tìm nhanh member trong group
GroupMemberSchema.index({ groupID: 1, userID: 1 }, { unique: true });

export default mongoose.model<IGroupMember>('GroupMembers', GroupMemberSchema, 'GroupMembers');
