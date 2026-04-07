import mongoose, { Document, Schema } from 'mongoose';

type MessageType = 'text' | 'image' | 'video' | 'emoji' | 'doc' | 'audio' | 'unsend' | 'file' | 'notification';

export interface IMessage extends Document {
  messageID: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: MessageType;
  timestamp: Date;
  media_url: string[];
  status: 'sent' | 'delivered' | 'read';
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
}

const MessageSchema = new Schema<IMessage>(
  {
    messageID: { type: String, unique: true, required: true },
    chatID: { type: String, required: true },
    senderID: { type: String, required: true },
    content: { type: String },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'emoji', 'doc', 'audio', 'unsend', 'file', 'notification'],
      default: 'text',
    },
    timestamp: { type: Date, default: Date.now },
    media_url: { type: [String], default: [] },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    replyTo: {
      messageID: { type: String },
      senderID: { type: String },
      content: { type: String },
      type: {
        type: String,
        enum: ['text', 'image', 'video', 'emoji', 'doc', 'audio', 'unsend', 'file'],
        default: 'text',
      },
      media_url: { type: [String], default: [] },
    },
    pinnedInfo: {
      pinnedBy: { type: String },
      pinnedAt: { type: Date, default: Date.now },
    },
  },
  { versionKey: false }
);

export default mongoose.model<IMessage>('messages', MessageSchema, 'messages');
