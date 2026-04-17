import mongoose, { Document, Schema } from 'mongoose';

type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'emoji'
  | 'doc'
  | 'audio'
  | 'unsend'
  | 'file'
  | 'notification'
  | 'sticker'
  | 'gif'
  | 'call-missed'
  | 'call-rejected'
  | 'call-ended'
  | 'call-cancelled';

export interface IMessage extends Document {
  messageID: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: MessageType;
  timestamp: Date;
  media_url: string[];
  status: 'sent' | 'delivered' | 'read';
  deletedFor?: string[]; //  Danh sách userID đã xóa tin nhắn phía client
  forwardedFrom?: string; //  MessageID gốc nếu là tin nhắn forward
  replyTo?: {
    messageID?: string;
    senderID?: string;
    content?: string;
    type?: Omit<MessageType, 'notification'>;
    media_url?: string[];
  };
  pinnedInfo?: {
    pinnedBy?: string;
    pinnedAt?: Date;
  };
  seenBy?: {
    userID: string;
    userName: string;
    avatar?: string | null;
    readAt: string;
  }[];
}

const MessageSchema = new Schema<IMessage>(
  {
    messageID: { type: String, unique: true, required: true },
    chatID: { type: String, required: true },
    senderID: { type: String, required: true },
    content: { type: String },
    type: {
      type: String,
      enum: [
        'text',
        'image',
        'video',
        'emoji',
        'doc',
        'audio',
        'unsend',
        'file',
        'notification',
        'sticker',
        'gif',
        'call-missed',
        'call-rejected',
        'call-ended',
        'call-cancelled',
      ],
      default: 'text',
    },
    timestamp: { type: Date, default: Date.now },
    media_url: { type: [String], default: [] },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    deletedFor: { type: [String], default: [] }, // ⭐ Mảng userID
    forwardedFrom: { type: String }, // ⭐ MessageID gốc
    replyTo: {
      messageID: { type: String },
      senderID: { type: String },
      content: { type: String },
      type: {
        type: String,
        enum: [
          'text',
          'image',
          'video',
          'emoji',
          'doc',
          'audio',
          'unsend',
          'file',
          'sticker',
          'gif',
          'call-missed',
          'call-rejected',
          'call-ended',
          'call-cancelled',
        ],
        default: 'text',
      },
      media_url: { type: [String], default: [] },
    },
    pinnedInfo: {
      type: {
        pinnedBy: { type: String },
        pinnedAt: { type: Date, default: Date.now },
      },
      default: undefined, // Không tạo object rỗng mặc định
    },
    seenBy: [
      {
        userID: { type: String, required: true },
        userName: { type: String },
        avatar: { type: String, default: null },
        readAt: { type: String },
        _id: false,
      },
    ],
  },
  { versionKey: false }
);

export default mongoose.model<IMessage>('messages', MessageSchema, 'messages');
