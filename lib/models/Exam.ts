import mongoose, { Document, Schema } from 'mongoose'

export interface IExamQuestion {
  questionId: mongoose.Types.ObjectId | string
  order: number
}

export interface IExam extends Document {
  title: string
  description?: string
  startTime: Date
  endTime: Date
  duration: number // 考试时长（分钟）
  maxTabSwitches: number // 最大切换标签页次数
  isPublished: boolean
  resultsPublished: boolean
  questions: IExamQuestion[] // 嵌入式文档存储考试题目
  createdAt: Date
  updatedAt: Date
  createdBy: mongoose.Types.ObjectId | string
}

const ExamQuestionSchema = new Schema<IExamQuestion>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: false })

const ExamSchema = new Schema<IExam>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  maxTabSwitches: {
    type: Number,
    default: 3
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  resultsPublished: {
    type: Boolean,
    default: false
  },
  questions: [ExamQuestionSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

export default mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema)