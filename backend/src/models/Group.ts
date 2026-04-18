import mongoose, { Document, Schema } from 'mongoose';

export interface IGroupSettings {
  requireApproval: boolean;
  highlightAdminMessages: boolean;
  allowNewMembersReadHistory: boolean;
  allowInviteLink: boolean;
  memberPermissions: {
    changeNameAvatar: boolean;
    pinMessages: boolean;
    createNotes: boolean;
    createPolls: boolean;
    sendMessages: boolean;
  };
}

export interface IGroup extends Document {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
  settings: IGroupSettings;
  blockedMembers: string[]; // danh sách userID bị chặn
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const GroupSchema = new Schema<IGroup>(
  {
    groupID: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    avatar: { type: String },
    description: { type: String },
    ownerID: { type: String, required: true },
    settings: {
      requireApproval: { type: Boolean, default: false },
      highlightAdminMessages: { type: Boolean, default: false },
      allowNewMembersReadHistory: { type: Boolean, default: false },
      allowInviteLink: { type: Boolean, default: true },
      memberPermissions: {
        changeNameAvatar: { type: Boolean, default: true },
        pinMessages: { type: Boolean, default: true },
        createNotes: { type: Boolean, default: true },
        createPolls: { type: Boolean, default: true },
        sendMessages: { type: Boolean, default: true },
      },
    },
    blockedMembers: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { versionKey: false }
);

export default mongoose.model<IGroup>('Groups', GroupSchema, 'Groups');
