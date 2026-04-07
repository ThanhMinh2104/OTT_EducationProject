import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMember extends Document {
  chatID: string;
  members: {
    userID: string;
    role: string;
  }[];
}

const ChatMemberSchema = new Schema<IChatMember>(
  {
    chatID: { type: String, required: true },
    members: [
      {
        userID: { type: String, required: true },
        role: { type: String, required: true },
      },
    ],
  },
  { versionKey: false }
);

export default mongoose.model<IChatMember>('ChatMembers', ChatMemberSchema, 'ChatMembers');
