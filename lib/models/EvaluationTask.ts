import mongoose from 'mongoose'

interface IEvaluationTask {
  examId: string
  teacherId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    completed: number
    current?: string
  }
  results?: any
  error?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

const evaluationTaskSchema = new mongoose.Schema<IEvaluationTask>({
  examId: {
    type: String,
    required: true,
    index: true
  },
  teacherId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  progress: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    current: { type: String }
  },
  results: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
})

// 创建复合索引（移除唯一约束，允许重新评测）
evaluationTaskSchema.index({ examId: 1, teacherId: 1, createdAt: -1 })
evaluationTaskSchema.index({ status: 1, createdAt: 1 })

export const EvaluationTask = mongoose.models.EvaluationTask || mongoose.model<IEvaluationTask>('EvaluationTask', evaluationTaskSchema)
export type { IEvaluationTask }