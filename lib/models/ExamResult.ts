import mongoose, { Document, Schema } from 'mongoose'

export interface IExamResult extends Document {
  examId: mongoose.Types.ObjectId | string
  studentId: mongoose.Types.ObjectId | string
  answers: string // JSON格式存储答案
  codeLanguages?: string // JSON格式存储编程语言选择
  score?: number
  isGraded: boolean
  gradedAt?: Date
  tabSwitches: number
  isSubmitted: boolean
  submittedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ExamResultSchema = new Schema<IExamResult>({
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: String, // JSON格式存储答案
    required: true
  },
  codeLanguages: {
    type: String, // JSON格式存储编程语言选择
    required: false
  },
  score: {
    type: Number,
    required: false
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  gradedAt: {
    type: Date,
    required: false
  },
  tabSwitches: {
    type: Number,
    default: 0
  },
  isSubmitted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
})

// 确保每个学生只能有一个考试结果
ExamResultSchema.index({ examId: 1, studentId: 1 }, { unique: true })

export default mongoose.models.ExamResult || mongoose.model<IExamResult>('ExamResult', ExamResultSchema)