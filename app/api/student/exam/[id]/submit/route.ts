import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 提交考试
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
    const { tabSwitches } = await request.json()

    // 获取考试信息
    const exam = await Exam.findById(examId)

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

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

    // 提交考试
    await ExamResult.findByIdAndUpdate(examResult._id, {
      isSubmitted: true,
      submittedAt: new Date(),
      tabSwitches: tabSwitches || examResult.tabSwitches,
      updatedAt: new Date()
    })

    return NextResponse.json({
      message: '考试提交成功'
    })
  } catch (error) {
    console.error('Submit exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}