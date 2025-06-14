import mongoose, { Document, Schema } from 'mongoose'

export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface IAppeal extends Document {
  resultId: mongoose.Types.ObjectId | string
  studentId: mongoose.Types.ObjectId | string
  teacherId?: mongoose.Types.ObjectId | string
  reason: string
  status: AppealStatus
  response?: string
  createdAt: Date
  updatedAt: Date
}

const AppealSchema = new Schema<IAppeal>({
  resultId: {
    type: Schema.Types.ObjectId,
    ref: 'ExamResult',
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  response: {
    type: String,
    required: false
  }
}, {
  timestamps: true
})

export default mongoose.models.Appeal || mongoose.model<IAppeal>('Appeal', AppealSchema)