import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupNote extends Document {
  noteID: string;
  groupID: string;
  creatorID: string;
  content: string;
  isPinned: boolean;
  pinnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GroupNoteSchema: Schema = new Schema(
  {
    noteID: { type: String, required: true, unique: true },
    groupID: { type: String, required: true, index: true },
    creatorID: { type: String, required: true },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for faster queries
GroupNoteSchema.index({ groupID: 1, isPinned: -1, createdAt: -1 });

export default mongoose.model<IGroupNote>('GroupNote', GroupNoteSchema);
