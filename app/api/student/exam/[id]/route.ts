import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 获取考试详情和学生答题记录
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
    if (!decoded || decoded.role !== 'STUDENT') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const examId = params.id

    // 获取考试信息
    const exam = await Exam.findById(examId).populate({
      path: 'questions.questionId',
      select: 'id title content type options points'
    })

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

    // 获取学生的答题记录
    let examResult = await ExamResult.findOne({
      examId: examId,
      studentId: decoded.userId
    })

    // 格式化考试数据
    const formattedExam = {
      id: exam._id,
      title: exam.title,
      description: exam.description,
      startTime: exam.startTime,
      endTime: exam.endTime,
      duration: exam.duration,
      maxTabSwitches: exam.maxTabSwitches,
      questions: exam.questions.map((examQuestion: any) => ({
        id: examQuestion.questionId._id,
        title: examQuestion.questionId.title,
        content: examQuestion.questionId.content,
        type: examQuestion.questionId.type,
        options: examQuestion.questionId.options,
        points: examQuestion.questionId.points,
        order: examQuestion.order
      }))
    }

    const formattedResult = examResult ? {
      id: examResult._id,
      answers: examResult.answers ? JSON.parse(examResult.answers) : {},
      tabSwitches: examResult.tabSwitches,
      isSubmitted: examResult.isSubmitted,
      createdAt: examResult.createdAt
    } : null

    return NextResponse.json({
      exam: formattedExam,
      examResult: formattedResult
    })
  } catch (error) {
    console.error('Get exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}