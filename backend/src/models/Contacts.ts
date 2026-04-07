import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
  contactID: string;
  userID: string;
  alias: string;
  status: string;
  created_at: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    contactID: { type: String, required: true },
    userID: { type: String, required: true },
    alias: { type: String, required: true },
    status: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model<IContact>('Contacts', ContactSchema, 'Contacts');
