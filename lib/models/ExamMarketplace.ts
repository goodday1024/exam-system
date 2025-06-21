import mongoose, { Document, Schema } from 'mongoose'

export interface IExamMarketplace extends Document {
  originalExamId: mongoose.Types.ObjectId | string // 原始考试ID
  title: string
  description?: string
  category: string // 考试分类（如：数学、编程、语言等）
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' // 难度等级
  duration: number // 考试时长（分钟）
  questionCount: number // 题目数量
  tags: string[] // 标签
  publishedBy: mongoose.Types.ObjectId | string // 发布者ID
  publishedByName: string // 发布者姓名
  publishedAt: Date // 发布时间
  downloadCount: number // 下载次数
  rating: number // 评分（1-5星）
  ratingCount: number // 评分人数
  isActive: boolean // 是否激活
  examData: string // JSON格式存储完整的考试数据（包括题目）
  previewQuestions: string // JSON格式存储预览题目（前3题）
  createdAt: Date
  updatedAt: Date
}

const ExamMarketplaceSchema = new Schema<IExamMarketplace>({
  originalExamId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  category: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['EASY', 'MEDIUM', 'HARD'],
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  questionCount: {
    type: Number,
    required: true
  },
  tags: [{
    type: String
  }],
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedByName: {
    type: String,
    required: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  examData: {
    type: String,
    required: true
  },
  previewQuestions: {
    type: String,
    required: true
  }
}, {
  timestamps: true
})

// 创建索引
ExamMarketplaceSchema.index({ category: 1 })
ExamMarketplaceSchema.index({ difficulty: 1 })
ExamMarketplaceSchema.index({ tags: 1 })
ExamMarketplaceSchema.index({ rating: -1 })
ExamMarketplaceSchema.index({ downloadCount: -1 })
ExamMarketplaceSchema.index({ publishedAt: -1 })

export default mongoose.models.ExamMarketplace || mongoose.model<IExamMarketplace>('ExamMarketplace', ExamMarketplaceSchema)