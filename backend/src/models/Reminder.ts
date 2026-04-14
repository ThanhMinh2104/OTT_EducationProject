import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  reminderID: string;
  chatID: string;
  userID: string;
  title: string;
  datetime: Date;
  repeat: 'none' | 'daily' | 'weekly';
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema: Schema = new Schema(
  {
    reminderID: { type: String, required: true, unique: true },
    chatID: { type: String, required: true, index: true },
    userID: { type: String, required: true, index: true },
    title: { type: String, required: true },
    datetime: { type: Date, required: true, index: true },
    repeat: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for efficient queries
ReminderSchema.index({ chatID: 1, done: 1 });
ReminderSchema.index({ datetime: 1, done: 1 });

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
