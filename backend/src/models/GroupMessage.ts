import mongoose, { Document, Schema } from 'mongoose';

type MessageType = 'text' | 'image' | 'video' | 'file' | 'audio' | 'emoji' | 'sticker' | 'notification' | 'gif' | 'group-call';

export interface IGroupMessage extends Document {
  messageID: string;
  groupID: string;
  senderID: string;
  content?: string;
  type: MessageType;
  media_url: string[];
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: {
    messageID: string;
    senderID: string;
    content?: string;
    type: MessageType;
  };
  pinnedInfo?: {
    pinnedBy: string;
    pinnedAt: Date;
  };
  seenBy: {
    userID: string;
    readAt: Date;
  }[];
  deletedFor: string[];
  forwardedFrom?: string;
  groupId?: string; // Thêm groupId để gom nhóm ảnh
  mentions: string[]; // Danh sách UserID được nhắc tên
}

const GroupMessageSchema = new Schema<IGroupMessage>(
  {
    messageID: { type: String, unique: true, required: true },
    groupID: { type: String, required: true, index: true },
    senderID: { type: String, required: true },
    content: { type: String },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'audio', 'emoji', 'sticker', 'notification', 'gif', 'group-call'],
      default: 'text',
    },
    media_url: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    replyTo: {
      messageID: { type: String },
      senderID: { type: String },
      content: { type: String },
      type: { type: String },
    },
    pinnedInfo: {
      pinnedBy: { type: String },
      pinnedAt: { type: Date },
    },
    seenBy: [
      {
        userID: { type: String, required: true },
        readAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    deletedFor: { type: [String], default: [] },
    forwardedFrom: { type: String },
    groupId: { type: String }, // Thêm groupId để gom nhóm ảnh
    mentions: { type: [String], default: [] },
  },
  { versionKey: false }
);

// Index để query nhanh tin nhắn theo group
GroupMessageSchema.index({ groupID: 1, timestamp: -1 });

export default mongoose.model<IGroupMessage>('GroupMessages', GroupMessageSchema, 'GroupMessages');
