import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { ExamResult } from '@/lib/models'

// 记录切换标签页
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (!decoded || decoded.role !== 'STUDENT') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const examId = params.id

    // 获取答题记录
    const examResult = await ExamResult.findOne({
      examId: examId,
      studentId: decoded.userId
    })

    if (!examResult) {
      return NextResponse.json(
        { error: '请先开始考试' },
        { status: 400 }
      )
    }

    if (examResult.isSubmitted) {
      return NextResponse.json(
        { error: '考试已提交' },
        { status: 400 }
      )
    }

    // 增加切换标签页次数
    const updatedResult = await ExamResult.findByIdAndUpdate(
      examResult._id,
      {
        tabSwitches: examResult.tabSwitches + 1,
        updatedAt: new Date()
      },
      { new: true }
    )

    return NextResponse.json({
      tabSwitches: updatedResult.tabSwitches
    })
  } catch (error) {
    console.error('Tab switch error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}