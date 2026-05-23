import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupReminderParticipant {
  userID: string;
  status: 'joined' | 'declined' | 'pending';
  updatedAt: Date;
}

export interface IGroupReminder extends Document {
  reminderID: string;
  groupID: string;
  creatorID: string;
  title: string;
  datetime: Date;
  repeat: 'none' | 'daily' | 'weekly';
  note?: string;
  participants: IGroupReminderParticipant[];
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GroupReminderSchema: Schema = new Schema(
  {
    reminderID: { type: String, required: true, unique: true },
    groupID: { type: String, required: true, index: true },
    creatorID: { type: String, required: true },
    title: { type: String, required: true },
    datetime: { type: Date, required: true, index: true },
    repeat: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
    note: { type: String, default: '' },
    participants: [
      {
        userID: { type: String, required: true },
        status: { type: String, enum: ['joined', 'declined', 'pending'], default: 'pending' },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GroupReminderSchema.index({ groupID: 1, done: 1 });
GroupReminderSchema.index({ datetime: 1, done: 1 });

export default mongoose.model<IGroupReminder>('GroupReminder', GroupReminderSchema);
