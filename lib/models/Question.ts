import mongoose, { Document, Schema } from 'mongoose'
import { IUser } from './User'

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'

export interface IQuestion extends Document {
  _id: string
  title: string
  content: string
  type: QuestionType
  options?: string
  correctAnswer: string
  testCases?: string // JSON格式存储测试样例，仅编程题使用
  language?: string // 编程语言，仅编程题使用
  points: number
  createdAt: Date
  updatedAt: Date
  createdBy: mongoose.Types.ObjectId | string
}

const QuestionSchema = new Schema<IQuestion>({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'PROGRAMMING'],
    required: true
  },
  options: {
    type: String, // JSON格式存储选项
    required: false
  },
  correctAnswer: {
    type: String,
    required: true
  },
  testCases: {
    type: String, // JSON格式存储测试样例
    required: false
  },
  language: {
    type: String, // 编程语言
    enum: ['javascript', 'cpp', 'c++'],
    default: 'javascript',
    required: false
  },
  points: {
    type: Number,
    default: 10
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

// 添加toJSON方法，将_id转换为id
QuestionSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
    return ret
  }
})

export default mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema)