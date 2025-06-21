import mongoose, { Document, Schema } from 'mongoose'

export interface IExamRating extends Document {
  examMarketplaceId: mongoose.Types.ObjectId | string
  userId: mongoose.Types.ObjectId | string
  userName: string
  rating: number // 1-5星评分
  comment?: string // 评价内容
  createdAt: Date
  updatedAt: Date
}

const ExamRatingSchema = new Schema<IExamRating>({
  examMarketplaceId: {
    type: Schema.Types.ObjectId,
    ref: 'ExamMarketplace',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: false
  }
}, {
  timestamps: true
})

// 确保每个用户对每个考试只能评分一次
ExamRatingSchema.index({ examMarketplaceId: 1, userId: 1 }, { unique: true })

export default mongoose.models.ExamRating || mongoose.model<IExamRating>('ExamRating', ExamRatingSchema)