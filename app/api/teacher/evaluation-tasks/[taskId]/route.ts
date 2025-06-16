import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { evaluationQueue } from '@/lib/evaluationQueue'

// 获取评测任务状态
export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
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

    const taskId = params.taskId

    // 获取任务状态
    const task = await evaluationQueue.getTaskStatus(taskId)

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      )
    }

    // 验证任务属于当前教师
    if (task.teacherId !== decoded.userId) {
      return NextResponse.json(
        { error: '无权限访问此任务' },
        { status: 403 }
      )
    }

    // 计算进度百分比
    const progressPercentage = task.progress.total > 0 
      ? Math.round((task.progress.completed / task.progress.total) * 100)
      : 0

    const response: any = {
      taskId: (task as any)._id?.toString(),
      examId: task.examId,
      status: task.status,
      progress: {
        ...task.progress,
        percentage: progressPercentage
      },
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      error: task.error
    }

    // 如果任务完成，包含结果
    if (task.status === 'completed' && task.results) {
      response.results = task.results
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('获取任务状态失败:', error)
    return NextResponse.json(
      { error: '获取任务状态失败' },
      { status: 500 }
    )
  }
}