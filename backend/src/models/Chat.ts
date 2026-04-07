import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  chatID: string;
  type: string;
  avatar: string;
  name: string;
  created_at: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    chatID: { type: String, required: true },
    type: { type: String, required: true },
    avatar: { type: String, required: true },
    name: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model<IChat>('Chats', ChatSchema, 'Chats');
