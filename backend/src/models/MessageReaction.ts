import mongoose, { Document, Schema } from 'mongoose';

export interface IMessageReaction extends Document {
  messageID: string;
  userID: string;
  emoji: string;
  createdAt: Date;
}

const MessageReactionSchema = new Schema<IMessageReaction>(
  {
    messageID: { type: String, required: true, index: true },
    userID: { type: String, required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Compound index để tìm reactions của một message
MessageReactionSchema.index({ messageID: 1, userID: 1 }, { unique: true });

export default mongoose.model<IMessageReaction>('MessageReactions', MessageReactionSchema, 'MessageReactions');
