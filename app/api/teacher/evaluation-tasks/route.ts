import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { EvaluationTask } from '@/lib/models/EvaluationTask'

// 获取教师的所有评测任务
export async function GET(request: NextRequest) {
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

    // 获取该教师的所有评测任务，按创建时间倒序排列
    const tasks = await EvaluationTask.find({
      teacherId: decoded.userId
    })
    .sort({ createdAt: -1 })
    .limit(50) // 限制返回最近50个任务

    // 为每个任务计算进度百分比
    const tasksWithProgress = tasks.map(task => {
      const progressPercentage = task.progress.total > 0 
        ? Math.round((task.progress.completed / task.progress.total) * 100)
        : 0

      return {
        _id: task._id,
        examId: task.examId,
        status: task.status,
        progress: {
          ...task.progress,
          percentage: progressPercentage
        },
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        error: task.error,
        // 只在任务完成时返回结果摘要
        ...(task.status === 'completed' && task.results && {
          results: task.results
        })
      }
    })

    return NextResponse.json({
      success: true,
      tasks: tasksWithProgress,
      total: tasks.length
    })

  } catch (error) {
    console.error('获取评测任务列表失败:', error)
    return NextResponse.json(
      { error: '获取任务列表失败' },
      { status: 500 }
    )
  }
}