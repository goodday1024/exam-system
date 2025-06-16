import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { EvaluationTask } from '@/lib/models'
import jwt from 'jsonwebtoken'

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    await connectDB()

    // 验证用户身份
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    } catch (error) {
      return NextResponse.json({ error: '无效的登录状态' }, { status: 401 })
    }

    if (decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { taskId } = params

    // 查找任务
    const task = await EvaluationTask.findById(taskId)
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }

    // 验证任务属于当前教师
    if (task.teacherId !== decoded.userId) {
      return NextResponse.json({ error: '无权限停止此任务' }, { status: 403 })
    }

    // 检查任务是否可以停止
    if (task.status === 'completed' || task.status === 'failed') {
      return NextResponse.json({ error: '任务已完成，无法停止' }, { status: 400 })
    }

    // 更新任务状态为失败（手动停止）
    await EvaluationTask.findByIdAndUpdate(taskId, {
      status: 'failed',
      error: '用户手动停止',
      endTime: new Date()
    })

    return NextResponse.json({ 
      success: true, 
      message: '任务已停止' 
    })

  } catch (error) {
    console.error('停止评测任务失败:', error)
    return NextResponse.json(
      { error: '停止任务失败' },
      { status: 500 }
    )
  }
}