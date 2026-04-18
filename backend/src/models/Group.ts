import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const GroupSchema = new Schema<IGroup>(
  {
    groupID: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    avatar: { type: String },
    description: { type: String },
    ownerID: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { versionKey: false }
);

export default mongoose.model<IGroup>('Groups', GroupSchema, 'Groups');
