import mongoose, { Document, Schema } from 'mongoose';

export interface IPollOption {
  text: string;
  voters: string[]; // Danh sách userID đã vote cho option này
}

export interface IPoll extends Document {
  pollID: string;
  groupID: string;
  creatorID: string;
  question: string;
  options: IPollOption[];
  isMultipleChoice: boolean; // Cho phép chọn nhiều option
  endTime?: Date; // Thời gian kết thúc (optional)
  canAddOptions: boolean; // Cho phép người khác thêm phương án
  hideResultsBeforeVote: boolean; // Ẩn kết quả khi chưa bình chọn
  isAnonymous: boolean; // Bình chọn ẩn danh
  createdAt: Date;
  isActive: boolean;
  isPinned: boolean;
  pinnedAt?: Date;
}

const PollSchema = new Schema<IPoll>(
  {
    pollID: { type: String, unique: true, required: true },
    groupID: { type: String, required: true, index: true },
    creatorID: { type: String, required: true },
    question: { type: String, required: true },
    options: [
      {
        text: { type: String, required: true },
        voters: { type: [String], default: [] },
        _id: false,
      },
    ],
    isMultipleChoice: { type: Boolean, default: false },
    endTime: { type: Date },
    canAddOptions: { type: Boolean, default: false },
    hideResultsBeforeVote: { type: Boolean, default: false },
    isAnonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
  },
  { versionKey: false }
);

// Index để query nhanh poll theo nhóm
PollSchema.index({ groupID: 1, createdAt: -1 });

export default mongoose.model<IPoll>('Polls', PollSchema, 'Polls');
