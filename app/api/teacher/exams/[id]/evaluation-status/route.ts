import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { EvaluationTask } from '@/lib/models'

// 获取考试的评测状态
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()

    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const examId = params.id

    // 查找该考试最新的活跃评测任务（只返回pending或processing状态的任务）
    const task = await EvaluationTask.findOne({
      examId,
      teacherId: decoded.userId,
      status: { $in: ['pending', 'processing'] }
    }).sort({ createdAt: -1 })

    if (!task) {
      return NextResponse.json({ task: null })
    }

    // 计算进度百分比
    const progressPercentage = task.progress.total > 0 
      ? Math.round((task.progress.completed / task.progress.total) * 100)
      : 0

    return NextResponse.json({
      task: {
        taskId: task._id.toString(),
        examId: task.examId,
        status: task.status,
        progress: {
          total: task.progress.total,
          completed: task.progress.completed,
          current: task.progress.current,
          percentage: progressPercentage
        },
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        error: task.error,
        results: task.results
      }
    })

  } catch (error) {
    console.error('获取评测状态失败:', error)
    return NextResponse.json(
      { error: '获取评测状态失败' },
      { status: 500 }
    )
  }
}