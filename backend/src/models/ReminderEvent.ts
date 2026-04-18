import mongoose, { Schema, Document } from 'mongoose';

export interface IReminderEvent extends Document {
  eventID: string;
  chatID: string;
  type: 'created' | 'deleted';
  reminderID: string;
  reminderData: {
    title: string;
    datetime: Date;
    repeat: string;
  };
  userName: string;
  userID: string;
  createdAt: Date;
}

const ReminderEventSchema: Schema = new Schema(
  {
    eventID: { type: String, required: true, unique: true },
    chatID: { type: String, required: true, index: true },
    type: { type: String, enum: ['created', 'deleted'], required: true },
    reminderID: { type: String, required: true },
    reminderData: {
      title: { type: String, required: true },
      datetime: { type: Date, required: true },
      repeat: { type: String, required: true },
    },
    userName: { type: String, required: true },
    userID: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for efficient queries
ReminderEventSchema.index({ chatID: 1, createdAt: -1 });

export default mongoose.model<IReminderEvent>('ReminderEvent', ReminderEventSchema);
