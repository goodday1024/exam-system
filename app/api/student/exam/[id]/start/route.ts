import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 开始考试
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

    // 获取考试信息
    const exam = await Exam.findById(examId)

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

    if (!exam.isPublished) {
      return NextResponse.json(
        { error: '考试尚未发布' },
        { status: 403 }
      )
    }

    // 检查考试时间
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (now < startTime) {
      return NextResponse.json(
        { error: '考试尚未开始' },
        { status: 403 }
      )
    }

    if (now > endTime) {
      return NextResponse.json(
        { error: '考试已结束' },
        { status: 403 }
      )
    }

    // 检查是否已经有答题记录
    const existingResult = await ExamResult.findOne({
      examId: examId,
      studentId: decoded.userId
    })

    if (existingResult) {
      return NextResponse.json(
        { error: '已经开始过此考试' },
        { status: 400 }
      )
    }

    // 创建答题记录
    const examResult = await ExamResult.create({
      examId: examId,
      studentId: decoded.userId,
      answers: '{}',
      tabSwitches: 0,
      isSubmitted: false
    })

    return NextResponse.json({
      message: '考试开始成功',
      examResult: {
        id: examResult._id,
        answers: {},
        tabSwitches: 0,
        isSubmitted: false,
        createdAt: examResult.createdAt
      }
    })
  } catch (error) {
    console.error('Start exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}