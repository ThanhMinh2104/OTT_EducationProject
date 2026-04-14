import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMember extends Document {
  chatID: string;
  members: {
    userID: string;
    role: string;
    deletedAt?: Date;
    historyDeletedAt?: Date;
  }[];
}

const ChatMemberSchema = new Schema<IChatMember>(
  {
    chatID: { type: String, required: true },
    members: [
      {
        userID: { type: String, required: true },
        role: { type: String, required: true },
        deletedAt: { type: Date, required: false },
        historyDeletedAt: { type: Date, required: false },
      },
    ],
  },
  { versionKey: false }
);

export default mongoose.model<IChatMember>('ChatMembers', ChatMemberSchema, 'ChatMembers');
